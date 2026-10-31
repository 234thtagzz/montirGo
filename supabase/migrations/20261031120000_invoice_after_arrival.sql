-- MontirGo — lewati tahap diagnosis/perbaikan.
-- Montir langsung mengisi tagihan begitu status order menjadi `arrived`.
-- Prasyarat: 20261024000000_xendit_payments_wallets.sql sudah dijalankan.
-- Idempotent: aman dijalankan ulang.

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

  -- Catatan: aktivitas "tagihan dikirim" dicatat oleh aplikasi montir
  -- (activity_logs, activity_type = 'invoice_sent') agar pesannya konsisten
  -- dengan aktivitas lain di tab Aktivitas.

  return v_request;
end;
$$;

grant execute on function public.set_order_price(uuid, integer) to authenticated;
