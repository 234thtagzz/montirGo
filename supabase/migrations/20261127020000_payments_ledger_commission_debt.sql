-- MontirGo Phase 3: 1-to-many payments, bucketed signed ledger, cash commission debt & credit limit.

-- ============ 1. PLATFORM SETTINGS ============
insert into public.platform_settings (key, value)
values ('max_cash_commission_debt', '100000')
on conflict (key) do nothing;

-- ============ 2. EVOLUSI TABEL PAYMENTS (1-TO-MANY ATTEMPTS) ============
alter table public.payments
  drop constraint if exists payments_request_id_key;

alter table public.payments
  add column if not exists attempt_no integer not null default 1;

with numbered as (
  select
    id,
    row_number() over (partition by request_id order by created_at asc, id asc) as rn
  from public.payments
)
update public.payments p
set attempt_no = n.rn
from numbered n
where p.id = n.id
  and p.attempt_no <> n.rn;

create unique index if not exists payments_one_paid_per_request
  on public.payments (request_id)
  where status = 'paid';

create unique index if not exists payments_one_pending_per_request
  on public.payments (request_id)
  where status = 'pending';

create unique index if not exists payments_request_attempt_key
  on public.payments (request_id, attempt_no);

create index if not exists payments_request_created_idx
  on public.payments (request_id, created_at desc);

create unique index if not exists payments_session_id_key
  on public.payments (payment_session_id)
  where payment_session_id is not null;

-- ============ 3. MECHANIC WALLETS & BUCKETED LEDGER ============
alter table public.mechanic_wallets
  add column if not exists commission_debt bigint not null default 0
  check (commission_debt >= 0);

alter table public.wallet_transactions
  add column if not exists bucket text not null default 'available';

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_bucket_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_bucket_check
  check (bucket in ('available', 'pending', 'held', 'commission_debt'));

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check
  check (type in (
    'earning_pending',
    'earning_release',
    'withdrawal_hold',
    'withdrawal_success',
    'withdrawal_refund',
    'cash_commission_fee',
    'cash_commission_debt_incurred',
    'commission_debt_offset',
    'commission_topup',
    'adjustment'
  ));

create index if not exists wt_mechanic_bucket_idx
  on public.wallet_transactions (mechanic_id, bucket, created_at desc);

-- ============ 4. ACCEPT REQUEST: BLOKIR JIKA UTANG KOMISI >= LIMIT ============
create or replace function public.accept_service_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_mech public.mechanic_profiles%rowtype;
  v_debt bigint := 0;
  v_max_debt bigint := public.setting_int('max_cash_commission_debt', 100000)::bigint;
  v_from_status text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if not public.has_role('mechanic') then
    raise exception 'Hanya akun montir yang bisa menerima request.' using errcode = '42501';
  end if;

  select * into v_mech
  from public.mechanic_profiles
  where profile_id = v_uid;

  if not found or not v_mech.is_verified then
    raise exception 'MECHANIC_NOT_VERIFIED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select coalesce(w.commission_debt, 0) into v_debt
  from public.mechanic_wallets w
  where w.mechanic_id = v_uid;

  if coalesce(v_debt, 0) >= v_max_debt then
    raise exception 'COMMISSION_DEBT_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request tidak ditemukan.' using errcode = 'P0002';
  end if;

  if v_request.status = 'mechanic_assigned'
     and v_request.assignment_expires_at is not null
     and v_request.assignment_expires_at <= now() then
    perform set_config('app.internal_rpc', '1', true);
    if v_request.mechanic_id is not null then
      update public.mechanic_profiles
      set is_available = true
      where profile_id = v_request.mechanic_id;
    end if;
    update public.service_requests
    set status = 'requested',
        mechanic_id = null,
        assignment_requested_at = null,
        assignment_expires_at = null
    where id = p_request_id
    returning * into v_request;
  end if;

  if v_request.mechanic_id = v_uid
     and v_request.status = 'mechanic_assigned'
     and (v_request.assignment_expires_at is null or v_request.assignment_expires_at > now()) then
    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'mechanic_id', v_request.mechanic_id,
      'assignment_expires_at', v_request.assignment_expires_at,
      'already_assigned', true
    );
  end if;

  if v_request.mechanic_id is not null then
    raise exception 'Request sudah diambil montir lain.' using errcode = 'P0001';
  end if;

  if v_request.status <> 'requested' then
    raise exception 'Request sudah tidak tersedia.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.service_request_assignment_rejections r
    where r.request_id = p_request_id and r.mechanic_id = v_uid
  ) then
    raise exception 'Client sudah menolak pengajuanmu untuk pesanan ini. Kamu tidak bisa mengajukan lagi.'
      using errcode = 'P0001';
  end if;

  if public.mechanic_active_order_id(v_uid) is not null then
    raise exception 'Kamu masih punya order aktif. Selesaikan order itu sampai lunas sebelum mengambil request baru.'
      using errcode = 'P0001';
  end if;

  v_from_status := v_request.status;
  perform set_config('app.internal_rpc', '1', true);

  update public.service_requests
  set mechanic_id = v_uid,
      status = 'mechanic_assigned',
      accepted_at = null,
      assignment_requested_at = now(),
      assignment_expires_at = now() + interval '5 minutes'
  where id = p_request_id
  returning * into v_request;

  update public.mechanic_profiles
  set is_available = false
  where profile_id = v_uid;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values
    (p_request_id, v_from_status, 'mechanic_assigned', v_uid,
     'Montir mengajukan diri. Menunggu konfirmasi client.');

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'order_assigned',
    'Mengajukan mengambil order #' || upper(left(p_request_id::text, 8)) || '. Menunggu konfirmasi client.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Montir ingin menangani pesananmu',
    'Lihat rating, ulasan, dan data bengkelnya lalu konfirmasi dalam 5 menit.',
    'assignment_requested',
    'service_request',
    p_request_id
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'mechanic_id', v_request.mechanic_id,
    'assignment_expires_at', v_request.assignment_expires_at,
    'already_assigned', false
  );
end;
$$;

-- ============ 5. RPC: FINALIZE ONLINE PAYMENT (SERVICE ROLE) ============
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
  v_pending_balance bigint;
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

  update public.payments
  set status = 'expired',
      updated_at = now()
  where request_id = v_request.id
    and id <> v_payment.id
    and status = 'pending';

  insert into public.earnings
    (mechanic_id, request_id, payment_id, gross_amount, platform_fee, net_amount,
     period_date, available_at, status, payment_method)
  values
    (v_request.mechanic_id, v_request.id, v_payment.id,
     v_payment.amount, v_payment.platform_fee, v_payment.net_amount,
     (now() at time zone 'Asia/Jakarta')::date,
     now() + make_interval(days => v_hold_days),
     'pending',
     'online')
  on conflict (request_id) do nothing;

  if found then
    insert into public.mechanic_wallets (mechanic_id)
    values (v_request.mechanic_id)
    on conflict (mechanic_id) do nothing;

    update public.mechanic_wallets
    set pending_balance = pending_balance + v_payment.net_amount,
        total_earned = total_earned + v_payment.net_amount,
        updated_at = now()
    where mechanic_id = v_request.mechanic_id
    returning pending_balance into v_pending_balance;

    insert into public.wallet_transactions
      (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
    values
      (v_request.mechanic_id, 'earning_pending', 'pending', v_payment.net_amount, v_pending_balance,
       'earning', v_request.id, 'Pendapatan order online lunas, menunggu masa hold.');
  end if;

  perform set_config('app.internal_rpc', '1', true);

  update public.service_requests
  set status = 'paid',
      payment_method = 'online',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = v_request.id and status <> 'paid';

  if v_prev_status <> 'paid' then
    update public.mechanic_profiles
    set is_available = true,
        total_jobs = coalesce(total_jobs, 0) + 1
    where profile_id = v_request.mechanic_id;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, notes)
    values
      (v_request.id, v_prev_status, 'paid', 'Pembayaran online terverifikasi.');
  end if;

  insert into public.activity_logs (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_request.mechanic_id,
    'payment_received',
    'Pembayaran online order #' || left(v_request.id::text, 8) || ' diterima.',
    'service_request',
    v_request.id
  );

  insert into public.notifications (user_id, title, body, type, related_entity_type, related_entity_id)
  values
    (
      v_request.client_id,
      'Pembayaran berhasil',
      'Pembayaran untuk order #' || left(v_request.id::text, 8) || ' telah dikonfirmasi.',
      'payment',
      'service_request',
      v_request.id
    ),
    (
      v_request.mechanic_id,
      'Order telah dibayar',
      'Order #' || left(v_request.id::text, 8) || ' lunas. Pendapatan bersih masuk ke saldo pending.',
      'payment',
      'service_request',
      v_request.id
    );
end;
$$;

-- ============ 6. RPC: CONFIRM CASH PAYMENT (SERVICE ROLE ONLY) ============
drop function if exists public.confirm_cash_payment(uuid);

create or replace function public.confirm_cash_payment(
  p_request_id uuid,
  p_mechanic_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests;
  v_payment public.payments;
  v_wallet public.mechanic_wallets;
  v_fee_percent integer := public.setting_int('fee_percent', 10);
  v_amount bigint;
  v_platform_fee bigint;
  v_net_amount bigint;
  v_deduct_avail bigint := 0;
  v_debt_added bigint := 0;
  v_next_attempt integer;
  v_prev_status text;
  v_new_avail bigint;
  v_new_debt bigint;
begin
  if p_request_id is null or p_mechanic_id is null then
    raise exception 'INVALID_ARGUMENT' using errcode = '22023';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from p_mechanic_id then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;

  if v_request.status = 'paid' then
    select * into v_payment
    from public.payments
    where request_id = p_request_id and status = 'paid' and method = 'cash'
    limit 1;
    if found then
      return v_payment;
    end if;
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  if v_request.status <> 'payment' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if v_request.payment_method is distinct from 'cash' then
    raise exception 'PAYMENT_METHOD_NOT_CASH' using errcode = 'P0001';
  end if;

  v_amount := v_request.price_amount;
  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.payments
    where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  -- Batalkan sesi online yang belum dibayar agar bisa diganti cash.
  update public.payments
  set status = 'expired',
      updated_at = now()
  where request_id = p_request_id and status = 'pending';

  select coalesce(max(attempt_no), 0) + 1 into v_next_attempt
  from public.payments
  where request_id = p_request_id;

  v_platform_fee := round((v_amount * v_fee_percent) / 100.0)::bigint;
  v_net_amount := v_amount - v_platform_fee;
  v_prev_status := v_request.status;

  insert into public.payments
    (request_id, attempt_no, amount, platform_fee, net_amount, currency,
     method, status, fee_percent, paid_at)
  values
    (p_request_id, v_next_attempt, v_amount, v_platform_fee, v_net_amount, 'IDR',
     'cash', 'paid', v_fee_percent, now())
  returning * into v_payment;

  insert into public.earnings
    (mechanic_id, request_id, payment_id, gross_amount, platform_fee, net_amount,
     period_date, available_at, status, payment_method)
  values
    (p_mechanic_id, p_request_id, v_payment.id, v_amount, v_platform_fee, v_net_amount,
     (now() at time zone 'Asia/Jakarta')::date, now(), 'settled_cash', 'cash')
  on conflict (request_id) do nothing;

  if found then
    insert into public.mechanic_wallets (mechanic_id)
    values (p_mechanic_id)
    on conflict (mechanic_id) do nothing;

    select * into v_wallet
    from public.mechanic_wallets
    where mechanic_id = p_mechanic_id
    for update;

    v_deduct_avail := least(v_wallet.available_balance, v_platform_fee);
    v_debt_added := v_platform_fee - v_deduct_avail;

    update public.mechanic_wallets
    set available_balance = available_balance - v_deduct_avail,
        commission_debt = commission_debt + v_debt_added,
        total_earned = total_earned + v_net_amount,
        updated_at = now()
    where mechanic_id = p_mechanic_id
    returning available_balance, commission_debt into v_new_avail, v_new_debt;

    if v_deduct_avail > 0 then
      insert into public.wallet_transactions
        (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
      values
        (p_mechanic_id, 'cash_commission_fee', 'available', -v_deduct_avail, v_new_avail,
         'payment', v_payment.id,
         'Potongan komisi platform order tunai #' || left(p_request_id::text, 8) || '.');
    end if;

    if v_debt_added > 0 then
      insert into public.wallet_transactions
        (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
      values
        (p_mechanic_id, 'cash_commission_debt_incurred', 'commission_debt', v_debt_added, v_new_debt,
         'payment', v_payment.id,
         'Hutang komisi platform order tunai #' || left(p_request_id::text, 8) || '.');
    end if;
  end if;

  perform set_config('app.internal_rpc', '1', true);

  update public.service_requests
  set status = 'paid',
      payment_method = 'cash',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = p_request_id;

  update public.mechanic_profiles
  set is_available = true,
      total_jobs = coalesce(total_jobs, 0) + 1
  where profile_id = p_mechanic_id;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values
    (p_request_id, v_prev_status, 'paid', p_mechanic_id,
     'Pembayaran tunai ' || v_amount::text || ' IDR dikonfirmasi montir.');

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    p_mechanic_id,
    'cash_payment_confirmed',
    'Pembayaran tunai order #' || left(p_request_id::text, 8) || ' sebesar ' ||
      v_amount::text || ' IDR dikonfirmasi. Komisi platform: ' ||
      v_platform_fee::text || ' IDR.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values
    (
      v_request.client_id,
      'Pembayaran tunai dikonfirmasi',
      'Montir mengonfirmasi pembayaran tunai Rp' || v_amount::text ||
        ' untuk order #' || left(p_request_id::text, 8) || '. Terima kasih.',
      'payment',
      'service_request',
      p_request_id
    ),
    (
      p_mechanic_id,
      'Pembayaran tunai dicatat',
      case
        when v_debt_added > 0 then
          'Pendapatan bersih Rp' || v_net_amount::text ||
          ' dicatat. Hutang komisi bertambah Rp' || v_debt_added::text || '.'
        else
          'Pendapatan bersih Rp' || v_net_amount::text ||
          ' dicatat. Komisi Rp' || v_deduct_avail::text || ' dipotong dari saldo.'
      end,
      'payment',
      'service_request',
      p_request_id
    );

  return v_payment;
end;
$$;

-- ============ 7. RPC: RELEASE MATURED EARNINGS + AUTO-OFFSET DEBT ============
drop function if exists public.release_matured_earnings();

create or replace function public.release_matured_earnings(
  p_mechanic_id uuid default null,
  p_batch_limit integer default 200
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
  v_wallet public.mechanic_wallets;
  v_avail bigint;
  v_pending bigint;
  v_debt bigint;
  v_offset bigint;
begin
  for r in
    select e.id, e.mechanic_id, e.net_amount
    from public.earnings e
    where e.status = 'pending'
      and e.available_at <= now()
      and (p_mechanic_id is null or e.mechanic_id = p_mechanic_id)
    order by e.available_at asc
    limit greatest(coalesce(p_batch_limit, 200), 1)
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

    select * into v_wallet
    from public.mechanic_wallets
    where mechanic_id = r.mechanic_id
    for update;

    update public.mechanic_wallets
    set available_balance = available_balance + r.net_amount,
        pending_balance = greatest(pending_balance - r.net_amount, 0),
        updated_at = now()
    where mechanic_id = r.mechanic_id
    returning available_balance, pending_balance, commission_debt
      into v_avail, v_pending, v_debt;

    insert into public.wallet_transactions
      (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
    values
      (r.mechanic_id, 'earning_release', 'pending', -r.net_amount, v_pending,
       'earning', r.id, 'Masa hold selesai, saldo pending dilepas.'),
      (r.mechanic_id, 'earning_release', 'available', r.net_amount, v_avail,
       'earning', r.id, 'Saldo pendapatan masuk saldo tersedia.');

    v_offset := least(v_avail, v_debt);
    if v_offset > 0 then
      update public.mechanic_wallets
      set available_balance = available_balance - v_offset,
          commission_debt = commission_debt - v_offset,
          updated_at = now()
      where mechanic_id = r.mechanic_id
      returning available_balance, commission_debt into v_avail, v_debt;

      insert into public.wallet_transactions
        (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
      values
        (r.mechanic_id, 'commission_debt_offset', 'available', -v_offset, v_avail,
         'earning', r.id, 'Pelunasan otomatis hutang komisi order tunai.'),
        (r.mechanic_id, 'commission_debt_offset', 'commission_debt', -v_offset, v_debt,
         'earning', r.id, 'Hutang komisi terlunasi otomatis dari pendapatan.');
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

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

  perform public.release_matured_earnings(v_uid, 200);

  insert into public.mechanic_wallets (mechanic_id)
  values (v_uid)
  on conflict (mechanic_id) do nothing;

  select * into v_wallet
  from public.mechanic_wallets
  where mechanic_id = v_uid;

  return v_wallet;
end;
$$;

-- ============ 8. RPC: REQUEST & SETTLE WITHDRAWAL (SERVICE ROLE) ============
drop function if exists public.request_withdrawal(bigint, uuid);

create or replace function public.request_withdrawal(
  p_mechanic_id uuid,
  p_amount bigint,
  p_account_id uuid
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.mechanic_wallets;
  v_account public.mechanic_payout_accounts;
  v_min bigint := public.setting_int('min_withdrawal', 50000)::bigint;
  v_avail bigint;
  v_held bigint;
  v_id uuid := gen_random_uuid();
  v_withdrawal public.withdrawals;
begin
  if p_mechanic_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_amount is null or p_amount < v_min then
    raise exception 'MIN_WITHDRAWAL';
  end if;

  perform public.release_matured_earnings(p_mechanic_id, 200);

  select * into v_account
  from public.mechanic_payout_accounts
  where id = p_account_id and mechanic_id = p_mechanic_id;

  if not found then
    raise exception 'INVALID_ACCOUNT';
  end if;

  if exists (
    select 1 from public.withdrawals
    where mechanic_id = p_mechanic_id and status in ('requested', 'processing')
  ) then
    raise exception 'ACTIVE_WITHDRAWAL_EXISTS';
  end if;

  select * into v_wallet
  from public.mechanic_wallets
  where mechanic_id = p_mechanic_id
  for update;

  if not found then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  if v_wallet.commission_debt > 0 then
    raise exception 'COMMISSION_DEBT_OUTSTANDING';
  end if;

  if v_wallet.available_balance < p_amount then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  update public.mechanic_wallets
  set available_balance = available_balance - p_amount,
      held_balance = held_balance + p_amount,
      updated_at = now()
  where mechanic_id = p_mechanic_id
  returning available_balance, held_balance into v_avail, v_held;

  insert into public.withdrawals
    (id, mechanic_id, amount, fee, status, payout_account_id, account_snapshot, reference_id)
  values (
    v_id,
    p_mechanic_id,
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
    (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
  values
    (p_mechanic_id, 'withdrawal_hold', 'available', -p_amount, v_avail,
     'withdrawal', v_id, 'Saldo ditahan sementara untuk pencairan.'),
    (p_mechanic_id, 'withdrawal_hold', 'held', p_amount, v_held,
     'withdrawal', v_id, 'Saldo masuk penahanan pencairan.');

  return v_withdrawal;
end;
$$;

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
  v_avail bigint;
  v_held bigint;
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
    returning held_balance into v_held;

    insert into public.wallet_transactions
      (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
    values
      (v_withdrawal.mechanic_id, 'withdrawal_success', 'held', -v_withdrawal.amount, v_held,
       'withdrawal', v_withdrawal.id, 'Pencairan berhasil dikirim ke rekening.');
  else
    update public.mechanic_wallets
    set held_balance = greatest(held_balance - v_withdrawal.amount, 0),
        available_balance = available_balance + v_withdrawal.amount,
        updated_at = now()
    where mechanic_id = v_withdrawal.mechanic_id
    returning available_balance, held_balance into v_avail, v_held;

    insert into public.wallet_transactions
      (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
    values
      (v_withdrawal.mechanic_id, 'withdrawal_refund', 'held', -v_withdrawal.amount, v_held,
       'withdrawal', v_withdrawal.id, 'Pelepasan dana tahan pencairan gagal.'),
      (v_withdrawal.mechanic_id, 'withdrawal_refund', 'available', v_withdrawal.amount, v_avail,
       'withdrawal', v_withdrawal.id, 'Pencairan gagal, saldo dikembalikan.');
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

-- ============ 9. RPC: TOP-UP / PELUNASAN HUTANG KOMISI ============
create or replace function public.record_commission_topup(
  p_mechanic_id uuid,
  p_amount bigint,
  p_ref_id uuid default null,
  p_note text default null
)
returns public.mechanic_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.mechanic_wallets;
  v_debt_paid bigint;
  v_excess bigint;
  v_new_debt bigint;
  v_new_avail bigint;
begin
  if p_mechanic_id is null or p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  insert into public.mechanic_wallets (mechanic_id)
  values (p_mechanic_id)
  on conflict (mechanic_id) do nothing;

  select * into v_wallet
  from public.mechanic_wallets
  where mechanic_id = p_mechanic_id
  for update;

  v_debt_paid := least(v_wallet.commission_debt, p_amount);
  v_excess := p_amount - v_debt_paid;

  update public.mechanic_wallets
  set commission_debt = commission_debt - v_debt_paid,
      available_balance = available_balance + v_excess,
      updated_at = now()
  where mechanic_id = p_mechanic_id
  returning * into v_wallet;

  v_new_debt := v_wallet.commission_debt;
  v_new_avail := v_wallet.available_balance;

  if v_debt_paid > 0 then
    insert into public.wallet_transactions
      (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
    values
      (p_mechanic_id, 'commission_topup', 'commission_debt', -v_debt_paid, v_new_debt,
       'topup', p_ref_id, coalesce(p_note, 'Pelunasan hutang komisi platform.'));
  end if;

  if v_excess > 0 then
    insert into public.wallet_transactions
      (mechanic_id, type, bucket, amount, balance_after, ref_type, ref_id, note)
    values
      (p_mechanic_id, 'commission_topup', 'available', v_excess, v_new_avail,
       'topup', p_ref_id, coalesce(p_note, 'Kelebihan setoran masuk ke saldo tersedia.'));
  end if;

  return v_wallet;
end;
$$;

-- ============ 10. HAK EKSEKUSI FUNGSI ============
revoke all on function public.accept_service_request(uuid) from public, anon;
grant execute on function public.accept_service_request(uuid) to authenticated;

revoke all on function public.refresh_my_wallet() from public, anon;
grant execute on function public.refresh_my_wallet() to authenticated;

revoke all on function public.finalize_payment(uuid) from public, anon, authenticated;
grant execute on function public.finalize_payment(uuid) to service_role;

revoke all on function public.confirm_cash_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_cash_payment(uuid, uuid) to service_role;

revoke all on function public.release_matured_earnings(uuid, integer) from public, anon, authenticated;
grant execute on function public.release_matured_earnings(uuid, integer) to service_role;

revoke all on function public.request_withdrawal(uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.request_withdrawal(uuid, bigint, uuid) to service_role;

revoke all on function public.settle_withdrawal(uuid, text, text) from public, anon, authenticated;
grant execute on function public.settle_withdrawal(uuid, text, text) to service_role;

revoke all on function public.record_commission_topup(uuid, bigint, uuid, text) from public, anon, authenticated;
grant execute on function public.record_commission_topup(uuid, bigint, uuid, text) to service_role;

-- ============ 11. JADWAL CRON: CAIRKAN SALDO MATANG SETIAP 15 MENIT ============
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'montirgo-release-earnings';

    perform cron.schedule(
      'montirgo-release-earnings',
      '*/15 * * * *',
      'select public.release_matured_earnings(null, 200);'
    );
  end if;
exception
  when others then null;
end $$;
