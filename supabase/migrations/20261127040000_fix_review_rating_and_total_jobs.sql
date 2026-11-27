-- Perbaiki trigger rating ulasan (terkena protect_mechanic_profile_columns)
-- dan cegah double-count pada mechanic_profiles.total_jobs.

-- 1. Trigger helper refresh_mechanic_rating & refresh_mechanic_jobs harus
-- menyetel app.internal_rpc = '1' selama UPDATE mechanic_profiles lalu
-- memulihkannya agar tidak bocor ke statement lain di transaksi yang sama.

create or replace function public.refresh_mechanic_rating(p_mechanic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_internal text := current_setting('app.internal_rpc', true);
begin
  if p_mechanic_id is null then
    return;
  end if;

  perform set_config('app.internal_rpc', '1', true);

  begin
    update public.mechanic_profiles mp
    set rating_avg = coalesce(
          (
            select round(avg(r.rating)::numeric, 1)
            from public.reviews r
            where r.mechanic_id = p_mechanic_id
              and r.is_visible = true
          ),
          0
        ),
        rating_count = (
          select count(*)
          from public.reviews r
          where r.mechanic_id = p_mechanic_id
            and r.is_visible = true
        )
    where mp.profile_id = p_mechanic_id;
  exception when others then
    perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
    raise;
  end;

  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
end;
$$;

create or replace function public.refresh_mechanic_jobs(p_mechanic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_internal text := current_setting('app.internal_rpc', true);
begin
  if p_mechanic_id is null then
    return;
  end if;

  perform set_config('app.internal_rpc', '1', true);

  begin
    update public.mechanic_profiles mp
    set total_jobs = (
      select count(*)
      from public.service_requests sr
      where sr.mechanic_id = p_mechanic_id
        and sr.status = 'paid'
    )
    where mp.profile_id = p_mechanic_id;
  exception when others then
    perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
    raise;
  end;

  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
end;
$$;

revoke all on function public.refresh_mechanic_rating(uuid) from public, anon, authenticated;
grant execute on function public.refresh_mechanic_rating(uuid) to service_role;

revoke all on function public.refresh_mechanic_jobs(uuid) from public, anon, authenticated;
grant execute on function public.refresh_mechanic_jobs(uuid) to service_role;

-- 2. Hapus increment manual total_jobs + 1 di finalize_payment & confirm_cash_payment
-- karena trg_service_requests_refresh_jobs sudah menghitung ulang count(*) where status = 'paid'.

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
    set is_available = true
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
  set is_available = true
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
        ' untuk order #' || left(v_request.id::text, 8) || '. Terima kasih.',
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

revoke all on function public.finalize_payment(uuid) from public, anon, authenticated;
grant execute on function public.finalize_payment(uuid) to service_role;

revoke all on function public.confirm_cash_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_cash_payment(uuid, uuid) to service_role;

-- 3. Backfill idempoten seluruh counter mechanic_profiles.
do $$
declare
  v_prev_internal text := current_setting('app.internal_rpc', true);
begin
  perform set_config('app.internal_rpc', '1', true);

  update public.mechanic_profiles mp
  set total_jobs = (
        select count(*)::int
        from public.service_requests sr
        where sr.mechanic_id = mp.profile_id
          and sr.status = 'paid'
      ),
      rating_avg = coalesce(
        (
          select round(avg(r.rating)::numeric, 1)
          from public.reviews r
          where r.mechanic_id = mp.profile_id
            and r.is_visible = true
        ),
        0
      ),
      rating_count = (
        select count(*)::int
        from public.reviews r
        where r.mechanic_id = mp.profile_id
          and r.is_visible = true
      );

  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
exception when others then
  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
  raise;
end $$;
