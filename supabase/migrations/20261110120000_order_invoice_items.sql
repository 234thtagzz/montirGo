-- MontirGo — tagihan terperinci (itemized invoicing).
--
-- Montir mengisi baris keterangan + harga (seperti nota pembayaran). Total
-- tagihan DIHITUNG SISTEM dari jumlah seluruh baris, bukan diketik manual.
-- Rincian dipakai sebagai bukti transparansi untuk client dan ditampilkan
-- kembali di detail riwayat aktivitas montir.
--
-- Prasyarat: 20261015000000_init_montirgo.sql,
--            20261024000000_xendit_payments_wallets.sql,
--            20261101130000_cash_payments.sql.
-- Idempotent: aman dijalankan ulang.

-- ============ 1. TABEL BARIS TAGIHAN ============
create table if not exists public.order_invoice_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  -- Keterangan tindakan / suku cadang, mis. "Ganti oli mesin".
  keterangan text not null check (char_length(btrim(keterangan)) > 0),
  -- Harga baris dalam rupiah (integer, tanpa desimal).
  harga integer not null check (harga > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oii_request_idx
  on public.order_invoice_items (request_id, created_at asc);

comment on table public.order_invoice_items is
  'Baris tagihan terperinci per order. Total = SUM(harga) dihitung server.';

-- updated_at otomatis (fungsi dari migrasi init).
drop trigger if exists set_order_invoice_items_updated_at on public.order_invoice_items;
create trigger set_order_invoice_items_updated_at
  before update on public.order_invoice_items
  for each row execute function public.handle_updated_at();

-- ============ 2. ROW LEVEL SECURITY ============
alter table public.order_invoice_items enable row level security;

-- Montir selalu boleh membaca barisnya; client baru boleh membaca setelah
-- tagihan benar-benar dikirim (status `payment` / `paid`) agar draft yang
-- masih diedit tidak terlihat lebih awal.
drop policy if exists oii_select_participant on public.order_invoice_items;
create policy oii_select_participant on public.order_invoice_items
  for select to authenticated using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and (
          sr.mechanic_id = auth.uid()
          or (sr.client_id = auth.uid() and sr.status in ('payment', 'paid'))
        )
    )
    or public.has_role('admin')
  );

-- Montir pemilik order boleh menulis baris hanya selama order masih dalam
-- tahap pengerjaan (sebelum tagihan dikirim / dibayar).
drop policy if exists oii_mechanic_insert on public.order_invoice_items;
create policy oii_mechanic_insert on public.order_invoice_items
  for insert to authenticated with check (
    mechanic_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status in ('arrived', 'diagnosing', 'repairing', 'completed')
        and not exists (
          select 1 from public.payments p
          where p.request_id = sr.id and p.status = 'paid'
        )
    )
  );

drop policy if exists oii_mechanic_update on public.order_invoice_items;
create policy oii_mechanic_update on public.order_invoice_items
  for update to authenticated
  using (
    mechanic_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status in ('arrived', 'diagnosing', 'repairing', 'completed')
        and not exists (
          select 1 from public.payments p
          where p.request_id = sr.id and p.status = 'paid'
        )
    )
  )
  with check (
    mechanic_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status in ('arrived', 'diagnosing', 'repairing', 'completed')
        and not exists (
          select 1 from public.payments p
          where p.request_id = sr.id and p.status = 'paid'
        )
    )
  );

drop policy if exists oii_mechanic_delete on public.order_invoice_items;
create policy oii_mechanic_delete on public.order_invoice_items
  for delete to authenticated using (
    mechanic_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status in ('arrived', 'diagnosing', 'repairing', 'completed')
        and not exists (
          select 1 from public.payments p
          where p.request_id = sr.id and p.status = 'paid'
        )
    )
  );

drop policy if exists oii_service_role_all on public.order_invoice_items;
create policy oii_service_role_all on public.order_invoice_items
  for all to service_role using (true) with check (true);

-- ============ 3. REALTIME ============
do $$
begin
  alter publication supabase_realtime add table public.order_invoice_items;
exception when duplicate_object then
  null;
end $$;

-- ============ 4. RPC: FINALISASI TAGIHAN TERPERINCI ============
-- Total dihitung dari SUM(harga) seluruh baris, lalu order dipindahkan ke
-- status `payment` agar client bisa membayar (online Xendit / tunai).
create or replace function public.finalize_order_invoice(p_request_id uuid)
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
  v_total integer;
  v_item_count integer;
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
  -- Status lama tetap diterima agar order yang sedang berjalan saat migrasi
  -- dipasang tidak terhambat.
  if v_request.status not in ('arrived', 'diagnosing', 'repairing', 'completed') then
    raise exception 'INVALID_STATUS';
  end if;
  if exists (
    select 1 from public.payments
    where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID';
  end if;

  select coalesce(sum(harga), 0)::integer, count(*)::integer
  into v_total, v_item_count
  from public.order_invoice_items
  where request_id = p_request_id;

  if v_item_count = 0 then
    raise exception 'NO_ITEMS';
  end if;
  if v_total < v_min or v_total > v_max then
    raise exception 'INVALID_PRICE';
  end if;

  v_prev_status := v_request.status;

  update public.service_requests
  set price_amount = v_total,
      status = 'payment',
      payment_method = null,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values
    (p_request_id, v_prev_status, 'payment', v_uid,
     'Montir mengirim tagihan terperinci ' || v_total::text ||
       ' IDR (' || v_item_count::text || ' baris).');

  -- Aktivitas montir menyimpan related_entity_id agar layar Aktivitas bisa
  -- membuka rincian baris tagihan saat entri diketuk.
  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'invoice_sent',
    'Tagihan terperinci order #' || left(p_request_id::text, 8) ||
      ' sebesar Rp' || v_total::text || ' (' || v_item_count::text ||
      ' baris) dikirim ke client.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Tagihan perbaikan siap dibayar',
    'Montir mengirim tagihan terperinci untuk order #' ||
      left(p_request_id::text, 8) ||
      '. Buka detail order untuk melihat rincian dan membayar.',
    'payment',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

revoke all on function public.finalize_order_invoice(uuid) from public, anon;
grant execute on function public.finalize_order_invoice(uuid) to authenticated;
