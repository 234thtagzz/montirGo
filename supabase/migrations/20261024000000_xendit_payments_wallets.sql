-- MontirGo — pembayaran Xendit, dompet montir, dan pencairan saldo.
-- Jalankan setelah migrasi awal: `npx supabase db push`.
-- Idempotent: aman dijalankan ulang (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).

-- ============ 0. PENGATURAN PLATFORM ============
create table if not exists public.platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (key, value) values
  ('fee_percent', '10'),
  ('hold_days', '2'),
  ('min_withdrawal', '50000'),
  ('min_order_price', '10000'),
  ('max_order_price', '10000000')
on conflict (key) do nothing;

-- ============ 1. KOLOM TAMBAHAN ============
alter table public.payments
  add column if not exists payment_session_id text,
  add column if not exists payment_url text,
  add column if not exists external_payment_id text,
  add column if not exists fee_percent numeric(5, 2) not null default 10;

alter table public.payment_events
  add column if not exists event_id text;

create unique index if not exists pe_event_id_key
  on public.payment_events (event_id) where event_id is not null;

alter table public.earnings
  add column if not exists payment_id uuid references public.payments (id) on delete set null,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'available', 'withdrawn', 'reversed'));

create index if not exists earnings_pending_idx
  on public.earnings (status, available_at) where status = 'pending';

-- ============ 2. TABEL DOMPET & PENCAIRAN ============
-- Rekening tujuan pencairan milik montir.
create table if not exists public.mechanic_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('bank', 'ewallet')),
  bank_code text not null,
  account_number text not null,
  account_holder_name text not null,
  -- Opsional: override routing Xendit bila bank tidak ada di daftar bawaan.
  routing_type text,
  routing_value text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique parsial (hanya satu rekening utama per montir).
create unique index if not exists mpa_one_primary
  on public.mechanic_payout_accounts (mechanic_id) where is_primary;

create index if not exists mpa_mechanic_idx
  on public.mechanic_payout_accounts (mechanic_id, created_at desc);

-- Saldo montir. Nilai uang dalam rupiah penuh (bukan sen).
create table if not exists public.mechanic_wallets (
  mechanic_id uuid primary key references public.profiles (id) on delete cascade,
  available_balance bigint not null default 0 check (available_balance >= 0),
  pending_balance bigint not null default 0 check (pending_balance >= 0),
  held_balance bigint not null default 0 check (held_balance >= 0),
  total_earned bigint not null default 0,
  total_withdrawn bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Permintaan pencairan.
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.profiles (id) on delete restrict,
  amount bigint not null check (amount > 0),
  fee bigint not null default 0 check (fee >= 0),
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'succeeded', 'failed', 'cancelled')),
  payout_account_id uuid references public.mechanic_payout_accounts (id) on delete set null,
  account_snapshot jsonb not null default '{}'::jsonb,
  xendit_payout_id text unique,
  reference_id text not null unique,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists wd_mechanic_idx
  on public.withdrawals (mechanic_id, created_at desc);

-- Satu pencairan aktif pada satu waktu (mencegah double submit).
create unique index if not exists wd_one_active
  on public.withdrawals (mechanic_id)
  where status in ('requested', 'processing');

-- Audit webhook payout.
create table if not exists public.withdrawal_events (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.withdrawals (id) on delete cascade,
  event_id text unique,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists we_withdrawal_idx
  on public.withdrawal_events (withdrawal_id, created_at desc);

-- Ledger audit: setiap perubahan saldo harus punya baris.
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'earning_pending', 'earning_release',
    'withdrawal_hold', 'withdrawal_success', 'withdrawal_refund',
    'adjustment'
  )),
  amount bigint not null,
  balance_after bigint not null,
  ref_type text,
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists wt_mechanic_idx
  on public.wallet_transactions (mechanic_id, created_at desc);

-- ============ 3. TRIGGER updated_at & WALLET OTOMATIS ============
drop trigger if exists set_mpa_updated_at on public.mechanic_payout_accounts;
create trigger set_mpa_updated_at
  before update on public.mechanic_payout_accounts
  for each row execute function public.handle_updated_at();

drop trigger if exists set_wd_updated_at on public.withdrawals;
create trigger set_wd_updated_at
  before update on public.withdrawals
  for each row execute function public.handle_updated_at();

drop trigger if exists set_ps_updated_at on public.platform_settings;
create trigger set_ps_updated_at
  before update on public.platform_settings
  for each row execute function public.handle_updated_at();

-- Setiap mechanic_profiles baru langsung punya baris dompet.
create or replace function public.ensure_mechanic_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mechanic_wallets (mechanic_id)
  values (new.profile_id)
  on conflict (mechanic_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_mechanic_wallet on public.mechanic_profiles;
create trigger trg_ensure_mechanic_wallet
  after insert on public.mechanic_profiles
  for each row execute function public.ensure_mechanic_wallet();

-- Backfill montir yang sudah ada.
insert into public.mechanic_wallets (mechanic_id)
select profile_id from public.mechanic_profiles
on conflict (mechanic_id) do nothing;

-- ============ 4. FUNGSI BANTU ============
create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value::integer from public.platform_settings where key = p_key),
    p_default
  );
$$;

-- ============ 5. RPC MONTIR: SET HARGA & MINTA PEMBAYARAN ============
create or replace function public.set_order_price(p_request_id uuid, p_price integer)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests;
  v_min integer := public.setting_int('min_order_price', 10000);
  v_max integer := public.setting_int('max_order_price', 10000000);
  v_prev_status text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER';
  end if;
  if v_request.status not in ('diagnosing', 'repairing', 'completed') then
    raise exception 'INVALID_STATUS';
  end if;
  if p_price is null or p_price < v_min or p_price > v_max then
    raise exception 'INVALID_PRICE';
  end if;
  if exists (
    select 1 from public.payments
    where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID';
  end if;

  v_prev_status := v_request.status;

  update public.service_requests
  set price_amount = p_price,
      status = 'payment',
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values
    (p_request_id, v_prev_status, 'payment', v_uid,
     'Montir mengirim tagihan ' || p_price::text || ' IDR.');

  insert into public.notifications (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Tagihan perbaikan siap dibayar',
    'Montir mengirim tagihan untuk order #' || left(p_request_id::text, 8) || '. Buka detail order untuk membayar.',
    'payment',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

-- ============ 6. RPC: SELESAIKAN PEMBAYARAN (DIPANGGIL WEBHOOK) ============
create or replace function public.finalize_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_request public.service_requests;
  v_hold_days integer := public.setting_int('hold_days', 2);
  v_balance bigint;
  v_prev_status text;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status = 'paid' then
    return;
  end if;

  select * into v_request
  from public.service_requests
  where id = v_payment.request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_request.mechanic_id is null then
    raise exception 'MECHANIC_NOT_ASSIGNED';
  end if;

  v_prev_status := v_request.status;

  update public.payments
  set status = 'paid',
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_payment.id;

  insert into public.earnings
    (mechanic_id, request_id, payment_id, gross_amount, platform_fee, net_amount,
     period_date, available_at, status)
  values
    (v_request.mechanic_id, v_request.id, v_payment.id,
     v_payment.amount, v_payment.platform_fee, v_payment.net_amount,
     (now() at time zone 'Asia/Jakarta')::date,
     now() + make_interval(days => v_hold_days),
     'pending')
  on conflict (request_id) do nothing;

  -- Hanya tambah saldo bila baris earning benar-benar baru.
  if found then
    insert into public.mechanic_wallets (mechanic_id)
    values (v_request.mechanic_id)
    on conflict (mechanic_id) do nothing;

    update public.mechanic_wallets
    set pending_balance = pending_balance + v_payment.net_amount,
        total_earned = total_earned + v_payment.net_amount,
        updated_at = now()
    where mechanic_id = v_request.mechanic_id
    returning pending_balance into v_balance;

    insert into public.wallet_transactions
      (mechanic_id, type, amount, balance_after, ref_type, ref_id, note)
    values
      (v_request.mechanic_id, 'earning_pending', v_payment.net_amount, v_balance,
       'earning', v_request.id, 'Pendapatan order lunas, menunggu settlement.');
  end if;

  update public.service_requests
  set status = 'paid', updated_at = now()
  where id = v_request.id and status <> 'paid';

  if v_prev_status <> 'paid' then
    insert into public.service_request_status_history
      (request_id, from_status, to_status, notes)
    values
      (v_request.id, v_prev_status, 'paid', 'Pembayaran terverifikasi otomatis.');
  end if;

  insert into public.activity_logs (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_request.mechanic_id,
    'payment_received',
    'Pembayaran order #' || left(v_request.id::text, 8) || ' diterima.',
    'service_request',
    v_request.id
  );

  insert into public.notifications (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.mechanic_id,
    'Pembayaran diterima',
    'Pendapatan bersih Rp' || v_payment.net_amount::text ||
      ' masuk ke saldo pending dan bisa ditarik setelah settlement.',
    'payment',
    'service_request',
    v_request.id
  );
end;
$$;

-- ============ 7. RPC: CAIRKAN PENDAPATAN YANG SUDAH MATANG ============
create or replace function public.release_matured_earnings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
  v_balance bigint;
begin
  for r in
    select e.id, e.mechanic_id, e.net_amount
    from public.earnings e
    where e.status = 'pending' and e.available_at <= now()
    for update of e skip locked
  loop
    update public.earnings
    set status = 'available'
    where id = r.id and status = 'pending';

    if not found then
      continue;
    end if;

    insert into public.mechanic_wallets (mechanic_id)
    values (r.mechanic_id)
    on conflict (mechanic_id) do nothing;

    update public.mechanic_wallets
    set available_balance = available_balance + r.net_amount,
        pending_balance = greatest(pending_balance - r.net_amount, 0),
        updated_at = now()
    where mechanic_id = r.mechanic_id
    returning available_balance into v_balance;

    insert into public.wallet_transactions
      (mechanic_id, type, amount, balance_after, ref_type, ref_id, note)
    values
      (r.mechanic_id, 'earning_release', r.net_amount, v_balance,
       'earning', r.id, 'Saldo pendapatan sudah dapat ditarik.');

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ============ 8. RPC: TARIK SALDO ============
create or replace function public.request_withdrawal(p_amount bigint, p_account_id uuid)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.mechanic_wallets;
  v_account public.mechanic_payout_accounts;
  v_min bigint := public.setting_int('min_withdrawal', 50000)::bigint;
  v_balance bigint;
  v_id uuid := gen_random_uuid();
  v_withdrawal public.withdrawals;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_amount is null or p_amount < v_min then
    raise exception 'MIN_WITHDRAWAL';
  end if;

  -- Lepaskan pendapatan yang sudah melewati masa hold.
  perform public.release_matured_earnings();

  select * into v_account
  from public.mechanic_payout_accounts
  where id = p_account_id and mechanic_id = v_uid;

  if not found then
    raise exception 'INVALID_ACCOUNT';
  end if;

  if exists (
    select 1 from public.withdrawals
    where mechanic_id = v_uid and status in ('requested', 'processing')
  ) then
    raise exception 'ACTIVE_WITHDRAWAL_EXISTS';
  end if;

  select * into v_wallet
  from public.mechanic_wallets
  where mechanic_id = v_uid
  for update;

  if not found or v_wallet.available_balance < p_amount then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.mechanic_wallets
  set available_balance = available_balance - p_amount,
      held_balance = held_balance + p_amount,
      updated_at = now()
  where mechanic_id = v_uid
  returning available_balance into v_balance;

  insert into public.withdrawals
    (id, mechanic_id, amount, fee, status, payout_account_id, account_snapshot, reference_id)
  values (
    v_id,
    v_uid,
    p_amount,
    0,
    'requested',
    v_account.id,
    jsonb_build_object(
      'id', v_account.id,
      'type', v_account.type,
      'bank_code', v_account.bank_code,
      'account_number', v_account.account_number,
      'account_holder_name', v_account.account_holder_name,
      'routing_type', v_account.routing_type,
      'routing_value', v_account.routing_value
    ),
    v_id::text
  )
  returning * into v_withdrawal;

  insert into public.wallet_transactions
    (mechanic_id, type, amount, balance_after, ref_type, ref_id, note)
  values
    (v_uid, 'withdrawal_hold', p_amount, v_balance,
     'withdrawal', v_id, 'Saldo ditahan sementara untuk pencairan.');

  return v_withdrawal;
end;
$$;

-- ============ 9. RPC: SELESAIKAN / GAGALKAN PENCAIRAN ============
create or replace function public.settle_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_failure_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal public.withdrawals;
  v_balance bigint;
begin
  if p_status not in ('succeeded', 'failed', 'cancelled') then
    raise exception 'INVALID_STATUS';
  end if;

  select * into v_withdrawal
  from public.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND';
  end if;
  if v_withdrawal.status in ('succeeded', 'failed', 'cancelled') then
    return;
  end if;

  if p_status = 'succeeded' then
    update public.mechanic_wallets
    set held_balance = greatest(held_balance - v_withdrawal.amount, 0),
        total_withdrawn = total_withdrawn + v_withdrawal.amount,
        updated_at = now()
    where mechanic_id = v_withdrawal.mechanic_id
    returning available_balance into v_balance;

    insert into public.wallet_transactions
      (mechanic_id, type, amount, balance_after, ref_type, ref_id, note)
    values
      (v_withdrawal.mechanic_id, 'withdrawal_success', v_withdrawal.amount, v_balance,
       'withdrawal', v_withdrawal.id, 'Pencairan berhasil.');
  else
    update public.mechanic_wallets
    set held_balance = greatest(held_balance - v_withdrawal.amount, 0),
        available_balance = available_balance + v_withdrawal.amount,
        updated_at = now()
    where mechanic_id = v_withdrawal.mechanic_id
    returning available_balance into v_balance;

    insert into public.wallet_transactions
      (mechanic_id, type, amount, balance_after, ref_type, ref_id, note)
    values
      (v_withdrawal.mechanic_id, 'withdrawal_refund', v_withdrawal.amount, v_balance,
       'withdrawal', v_withdrawal.id,
       'Pencairan gagal, saldo dikembalikan.');
  end if;

  update public.withdrawals
  set status = p_status,
      failure_code = coalesce(p_failure_code, failure_code),
      completed_at = now(),
      updated_at = now()
  where id = v_withdrawal.id;

  insert into public.notifications (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_withdrawal.mechanic_id,
    case when p_status = 'succeeded' then 'Pencairan berhasil' else 'Pencairan gagal' end,
    case
      when p_status = 'succeeded'
        then 'Dana Rp' || v_withdrawal.amount::text || ' sedang dikirim ke rekening tujuan.'
      else 'Dana Rp' || v_withdrawal.amount::text || ' dikembalikan ke saldo MontirGo.'
    end,
    'withdrawal',
    'withdrawal',
    v_withdrawal.id
  );
end;
$$;

-- ============ 10. RPC: REFRESH DOMPET SAYA ============
create or replace function public.refresh_my_wallet()
returns public.mechanic_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.mechanic_wallets;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  perform public.release_matured_earnings();

  insert into public.mechanic_wallets (mechanic_id)
  values (v_uid)
  on conflict (mechanic_id) do nothing;

  select * into v_wallet
  from public.mechanic_wallets
  where mechanic_id = v_uid;

  return v_wallet;
end;
$$;

-- ============ 11. ROW LEVEL SECURITY ============
alter table public.platform_settings enable row level security;
alter table public.mechanic_payout_accounts enable row level security;
alter table public.mechanic_wallets enable row level security;
alter table public.withdrawals enable row level security;
alter table public.withdrawal_events enable row level security;
alter table public.wallet_transactions enable row level security;

-- platform_settings: semua user login boleh baca.
drop policy if exists ps_select_authenticated on public.platform_settings;
create policy ps_select_authenticated on public.platform_settings
  for select to authenticated using (true);

drop policy if exists ps_service_role_all on public.platform_settings;
create policy ps_service_role_all on public.platform_settings
  for all to service_role using (true) with check (true);

-- Rekening pencairan: montir hanya mengelola miliknya.
drop policy if exists mpa_select_own on public.mechanic_payout_accounts;
create policy mpa_select_own on public.mechanic_payout_accounts
  for select to authenticated using (mechanic_id = auth.uid() or public.has_role('admin'));

drop policy if exists mpa_insert_own on public.mechanic_payout_accounts;
create policy mpa_insert_own on public.mechanic_payout_accounts
  for insert to authenticated with check (mechanic_id = auth.uid());

drop policy if exists mpa_update_own on public.mechanic_payout_accounts;
create policy mpa_update_own on public.mechanic_payout_accounts
  for update to authenticated
  using (mechanic_id = auth.uid())
  with check (mechanic_id = auth.uid());

drop policy if exists mpa_delete_own on public.mechanic_payout_accounts;
create policy mpa_delete_own on public.mechanic_payout_accounts
  for delete to authenticated using (mechanic_id = auth.uid());

drop policy if exists mpa_service_role_all on public.mechanic_payout_accounts;
create policy mpa_service_role_all on public.mechanic_payout_accounts
  for all to service_role using (true) with check (true);

-- Dompet: baca milik sendiri, tulis hanya lewat RPC/backend.
drop policy if exists mw_select_own on public.mechanic_wallets;
create policy mw_select_own on public.mechanic_wallets
  for select to authenticated using (mechanic_id = auth.uid() or public.has_role('admin'));

drop policy if exists mw_service_role_all on public.mechanic_wallets;
create policy mw_service_role_all on public.mechanic_wallets
  for all to service_role using (true) with check (true);

-- Pencairan: baca milik sendiri.
drop policy if exists wd_select_own on public.withdrawals;
create policy wd_select_own on public.withdrawals
  for select to authenticated using (mechanic_id = auth.uid() or public.has_role('admin'));

drop policy if exists wd_service_role_all on public.withdrawals;
create policy wd_service_role_all on public.withdrawals
  for all to service_role using (true) with check (true);

-- Audit pencairan: hanya admin & backend.
drop policy if exists we_select_admin on public.withdrawal_events;
create policy we_select_admin on public.withdrawal_events
  for select to authenticated using (public.has_role('admin'));

drop policy if exists we_service_role_all on public.withdrawal_events;
create policy we_service_role_all on public.withdrawal_events
  for all to service_role using (true) with check (true);

-- Ledger: baca milik sendiri.
drop policy if exists wt_select_own on public.wallet_transactions;
create policy wt_select_own on public.wallet_transactions
  for select to authenticated using (mechanic_id = auth.uid() or public.has_role('admin'));

drop policy if exists wt_service_role_all on public.wallet_transactions;
create policy wt_service_role_all on public.wallet_transactions
  for all to service_role using (true) with check (true);

-- ============ 12. HAK EKSEKUSI FUNGSI ============revoke all on function public.set_order_price(uuid, integer) from public, anon;
grant execute on function public.set_order_price(uuid, integer) to authenticated;

revoke all on function public.request_withdrawal(bigint, uuid) from public, anon;
grant execute on function public.request_withdrawal(bigint, uuid) to authenticated;

revoke all on function public.refresh_my_wallet() from public, anon;
grant execute on function public.refresh_my_wallet() to authenticated;

revoke all on function public.finalize_payment(uuid) from public, anon, authenticated;
grant execute on function public.finalize_payment(uuid) to service_role;

revoke all on function public.settle_withdrawal(uuid, text, text) from public, anon, authenticated;
grant execute on function public.settle_withdrawal(uuid, text, text) to service_role;

revoke all on function public.release_matured_earnings() from public, anon, authenticated;
grant execute on function public.release_matured_earnings() to service_role;

-- ============ 13. REALTIME ============
-- Klien berlangganan perubahan status pembayaran, saldo, dan pencairan.
do $$
begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.earnings;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.mechanic_wallets;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.withdrawals;
exception when duplicate_object then
  null;
end $$;

-- Opsional: jalankan pelepasan saldo otomatis bila pg_cron aktif.
-- select cron.schedule(
--   'release-matured-earnings',
--   '*/30 * * * *',
--   $$select public.release_matured_earnings();$$
-- );
