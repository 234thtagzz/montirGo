-- MontirGo — pembayaran tunai (cash) yang dikonfirmasi montir.
--
-- Alur:
--   1. Client memilih metode pembayaran di layar pembayaran:
--      `choose_payment_method(request_id, 'cash' | 'online')`.
--   2. Client membayar tunai langsung ke montir.
--   3. Montir menekan "Konfirmasi Pembayaran Cash":
--      `confirm_cash_payment(request_id)`.
--
-- Pendapatan tunai tetap dicatat di tabel `earnings`, tetapi:
--   * status earning = 'settled_cash' sehingga tidak pernah disentuh
--     `release_matured_earnings()` (filter status = 'pending');
--   * `mechanic_wallets` dan `wallet_transactions` TIDAK diubah, jadi uang
--     tunai tidak masuk saldo virtual / tidak bisa ditarik lewat aplikasi.
--
-- Idempotent: aman dijalankan ulang (add column if not exists / or replace).

-- ============ 1. KOLOM METODE PEMBAYARAN ============
alter table public.service_requests
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('online', 'cash'));

comment on column public.service_requests.payment_method is
  'Pilihan metode pembayaran client saat order berstatus payment (online/cash).';

alter table public.earnings
  add column if not exists payment_method text not null default 'online'
    check (payment_method in ('online', 'cash'));

comment on column public.earnings.payment_method is
  'online = dana masuk dompet MontirGo; cash = diterima langsung oleh montir.';

-- Status earning khusus tunai: tidak diproses oleh release_matured_earnings
-- sehingga tidak pernah menambah saldo dompet.
alter table public.earnings drop constraint if exists earnings_status_check;
alter table public.earnings add constraint earnings_status_check
  check (status in ('pending', 'available', 'withdrawn', 'reversed', 'settled_cash'));

-- ============ 2. SET HARGA: RESET PILIHAN METODE ============
-- Tagihan baru selalu mengosongkan pilihan metode sebelumnya supaya client
-- memilih ulang (tunai / online) untuk nominal yang baru.
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
  -- `arrived` adalah status utama alur baru; status lama tetap diterima agar
  -- order yang masih berjalan saat migrasi ini dipasang tidak terhambat.
  if v_request.status not in ('arrived', 'diagnosing', 'repairing', 'completed') then
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
      payment_method = null,
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

-- ============ 3. RPC CLIENT: PILIH METODE PEMBAYARAN ============
create or replace function public.choose_payment_method(p_request_id uuid, p_method text)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_method not in ('online', 'cash') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if v_request.client_id is distinct from v_uid then
    raise exception 'NOT_YOUR_REQUEST';
  end if;
  if v_request.status <> 'payment' then
    raise exception 'INVALID_STATUS';
  end if;
  if exists (
    select 1 from public.payments
    where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID';
  end if;

  update public.service_requests
  set payment_method = p_method,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  if p_method = 'cash' then
    insert into public.activity_logs
      (user_id, activity_type, description, related_entity_type, related_entity_id)
    values (
      v_uid,
      'payment_method_selected',
      'Client memilih pembayaran tunai untuk order #' || left(p_request_id::text, 8) || '.',
      'service_request',
      p_request_id
    );

    insert into public.notifications
      (user_id, title, body, type, related_entity_type, related_entity_id)
    values (
      v_request.mechanic_id,
      'Client memilih bayar tunai',
      'Client order #' || left(p_request_id::text, 8) ||
        ' akan membayar tunai ' || coalesce(v_request.price_amount, 0)::text ||
        ' IDR. Konfirmasi pembayaran setelah uang diterima.',
      'payment',
      'service_request',
      p_request_id
    );
  end if;

  return v_request;
end;
$$;

-- ============ 4. RPC MONTIR: KONFIRMASI PEMBAYARAN TUNAI ============
create or replace function public.confirm_cash_payment(p_request_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests;
  v_payment public.payments;
  v_fee_percent integer := public.setting_int('fee_percent', 10);
  v_amount integer;
  v_platform_fee integer;
  v_net_amount integer;
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

  select * into v_payment
  from public.payments
  where request_id = p_request_id
  for update;

  -- Idempotent: konfirmasi ganda mengembalikan baris pembayaran tunai yang sama.
  if v_request.status = 'paid' then
    if found and v_payment.status = 'paid' and v_payment.method = 'cash' then
      return v_payment;
    end if;
    raise exception 'ALREADY_PAID';
  end if;

  if v_request.status <> 'payment' then
    raise exception 'INVALID_STATUS';
  end if;

  v_amount := v_request.price_amount;
  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID_PRICE';
  end if;

  if v_payment.id is not null and v_payment.status = 'paid' then
    raise exception 'ALREADY_PAID';
  end if;

  v_platform_fee := round((v_amount * v_fee_percent) / 100.0);
  v_net_amount := v_amount - v_platform_fee;
  v_prev_status := v_request.status;

  if v_payment.id is null then
    insert into public.payments
      (request_id, amount, platform_fee, net_amount, currency,
       method, status, fee_percent, paid_at)
    values
      (p_request_id, v_amount, v_platform_fee, v_net_amount, 'IDR',
       'cash', 'paid', v_fee_percent, now())
    returning * into v_payment;
  else
    -- Bila sebelumnya client sempat membuka checkout Xendit, baris yang sama
    -- dipakai ulang (unique request_id) dan sesi online-nya dilepas.
    update public.payments
    set amount = v_amount,
        platform_fee = v_platform_fee,
        net_amount = v_net_amount,
        currency = 'IDR',
        fee_percent = v_fee_percent,
        method = 'cash',
        status = 'paid',
        gateway_reference = null,
        payment_session_id = null,
        payment_url = null,
        qr_payload = null,
        expires_at = null,
        paid_at = coalesce(paid_at, now()),
        updated_at = now()
    where id = v_payment.id
    returning * into v_payment;
  end if;

  -- Pendapatan tunai: status 'settled_cash' tidak diproses
  -- release_matured_earnings, dan saldo dompet sengaja TIDAK disentuh.
  insert into public.earnings
    (mechanic_id, request_id, payment_id, gross_amount, platform_fee, net_amount,
     period_date, available_at, status, payment_method)
  values
    (v_uid, p_request_id, v_payment.id, v_amount, v_platform_fee, v_net_amount,
     (now() at time zone 'Asia/Jakarta')::date, now(), 'settled_cash', 'cash')
  on conflict (request_id) do nothing;

  update public.service_requests
  set status = 'paid',
      payment_method = 'cash',
      updated_at = now()
  where id = p_request_id;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values
    (p_request_id, v_prev_status, 'paid', v_uid,
     'Pembayaran tunai ' || v_amount::text || ' IDR dikonfirmasi montir.');

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'cash_payment_confirmed',
    'Pembayaran tunai order #' || left(p_request_id::text, 8) || ' sebesar ' ||
      v_amount::text || ' IDR dikonfirmasi. Pendapatan bersih ' ||
      v_net_amount::text || ' IDR (tidak masuk saldo dompet).',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Pembayaran tunai dikonfirmasi',
    'Montir mengonfirmasi pembayaran tunai ' || v_amount::text ||
      ' IDR untuk order #' || left(p_request_id::text, 8) || '. Terima kasih.',
    'payment',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_uid,
    'Pembayaran tunai dicatat',
    'Pendapatan tunai bersih ' || v_net_amount::text ||
      ' IDR tercatat di Pendapatan. Uang tunai tidak masuk saldo dompet MontirGo.',
    'payment',
    'service_request',
    p_request_id
  );

  return v_payment;
end;
$$;

-- ============ 5. HAK EKSEKUSI ============
revoke all on function public.choose_payment_method(uuid, text) from public, anon;
grant execute on function public.choose_payment_method(uuid, text) to authenticated;

revoke all on function public.confirm_cash_payment(uuid) from public, anon;
grant execute on function public.confirm_cash_payment(uuid) to authenticated;
