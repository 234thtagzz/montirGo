-- MontirGo Stage 2: Callout Fee Tiers, Digital Approval in `arrived`, `quote-photos`,
-- Mechanic Vehicle Fields (Post-Assignment), and `callout_only` Accounting.
-- Prasyarat: 20261127000000..20261127040000.
-- Idempotent: aman dijalankan ulang maupun lewat `supabase db reset`.

-- ============ 1. PLATFORM SETTINGS ============
insert into public.platform_settings (key, value) values
  ('callout_fee_motor', '25000'),
  ('callout_fee_mobil', '45000'),
  ('callout_fee_derek', '100000'),
  ('quote_expire_minutes', '15'),
  ('cs_whatsapp_number', '6281100000001')
on conflict (key) do nothing;

-- ============ 2. SERVICE REQUESTS: CALLOUT TIER & DIGITAL APPROVAL SUB-STATUS ============
-- Kontrak 8 status resmi `service_requests.status` tetap utuh.
alter table public.service_requests
  add column if not exists callout_fee_tier text not null default 'motor',
  add column if not exists callout_fee_amount bigint not null default 25000,
  add column if not exists quote_status text not null default 'draft',
  add column if not exists quote_submitted_at timestamptz,
  add column if not exists quote_approved_at timestamptz,
  add column if not exists quote_expires_at timestamptz,
  add column if not exists quote_revision_note text,
  add column if not exists quote_photo_paths text[] not null default '{}',
  add column if not exists rejected_quote_snapshot jsonb;

alter table public.service_requests
  drop constraint if exists sr_callout_fee_tier_check,
  add constraint sr_callout_fee_tier_check
    check (callout_fee_tier in ('motor', 'mobil', 'derek'));

alter table public.service_requests
  drop constraint if exists sr_callout_fee_amount_check,
  add constraint sr_callout_fee_amount_check
    check (callout_fee_amount >= 0);

alter table public.service_requests
  drop constraint if exists sr_quote_status_check,
  add constraint sr_quote_status_check
    check (quote_status in ('draft', 'pending_approval', 'approved', 'callout_only'));

alter table public.service_requests
  drop constraint if exists sr_quote_photo_paths_len_check,
  add constraint sr_quote_photo_paths_len_check
    check (coalesce(array_length(quote_photo_paths, 1), 0) <= 3);

update public.service_requests
set quote_status = 'approved'
where status = 'paid'
  and quote_status = 'draft';

create index if not exists sr_quote_pending_idx
  on public.service_requests (quote_expires_at)
  where status = 'arrived' and quote_status = 'pending_approval';

-- ============ 3. ORDER INVOICE ITEMS: CALLOUT LOCK, APPROVAL & SOFT-VOID ============
alter table public.order_invoice_items
  add column if not exists item_type text not null default 'service',
  add column if not exists is_locked boolean not null default false,
  add column if not exists approved_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists quote_photo_paths text[] not null default '{}';

alter table public.order_invoice_items
  drop constraint if exists oii_item_type_check,
  add constraint oii_item_type_check
    check (item_type in ('callout_fee', 'service', 'parts', 'addon'));

alter table public.order_invoice_items
  drop constraint if exists oii_quote_photo_paths_len_check,
  add constraint oii_quote_photo_paths_len_check
    check (coalesce(array_length(quote_photo_paths, 1), 0) <= 3);

create unique index if not exists oii_one_callout_per_request
  on public.order_invoice_items (request_id)
  where item_type = 'callout_fee' and voided_at is null;

create or replace function public.protect_order_invoice_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or current_setting('app.internal_rpc', true) = '1'
     or public.has_role('admin') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_locked or old.item_type = 'callout_fee' then
      raise exception 'CALLOUT_ITEM_LOCKED' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.item_type = 'callout_fee'
       or new.is_locked = true
       or new.approved_at is not null
       or new.voided_at is not null then
      raise exception 'PROTECTED_INVOICE_FIELD' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.is_locked or old.item_type = 'callout_fee' then
    raise exception 'CALLOUT_ITEM_LOCKED' using errcode = '42501';
  end if;

  if new.item_type = 'callout_fee'
     or new.is_locked is distinct from old.is_locked
     or new.approved_at is distinct from old.approved_at
     or new.voided_at is distinct from old.voided_at then
    raise exception 'PROTECTED_INVOICE_FIELD' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_order_invoice_items on public.order_invoice_items;
create trigger trg_protect_order_invoice_items
  before insert or update or delete on public.order_invoice_items
  for each row execute function public.protect_order_invoice_items();

drop policy if exists oii_select_participant on public.order_invoice_items;
create policy oii_select_participant on public.order_invoice_items
  for select to authenticated using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and (
          sr.mechanic_id = auth.uid()
          or (
            sr.client_id = auth.uid()
            and (
              sr.status in ('payment', 'paid')
              or (
                sr.status = 'arrived'
                and sr.quote_status in ('pending_approval', 'approved', 'callout_only')
              )
            )
          )
        )
    )
    or public.has_role('admin')
  );

drop policy if exists oii_mechanic_insert on public.order_invoice_items;
create policy oii_mechanic_insert on public.order_invoice_items
  for insert to authenticated
  with check (
    mechanic_id = auth.uid()
    and item_type in ('service', 'parts', 'addon')
    and is_locked = false
    and approved_at is null
    and voided_at is null
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
        and sr.quote_status = 'draft'
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
    and is_locked = false
    and item_type <> 'callout_fee'
    and voided_at is null
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
        and sr.quote_status = 'draft'
    )
  )
  with check (
    mechanic_id = auth.uid()
    and is_locked = false
    and item_type in ('service', 'parts', 'addon')
    and approved_at is null
    and voided_at is null
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
        and sr.quote_status = 'draft'
    )
  );

drop policy if exists oii_mechanic_delete on public.order_invoice_items;
create policy oii_mechanic_delete on public.order_invoice_items
  for delete to authenticated
  using (
    mechanic_id = auth.uid()
    and is_locked = false
    and item_type <> 'callout_fee'
    and voided_at is null
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
        and sr.quote_status = 'draft'
    )
  );

-- ============ 4. HELPER CALLOUT ITEM & CREATE_SERVICE_REQUEST ============
create or replace function public.ensure_callout_invoice_item(p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_internal text := current_setting('app.internal_rpc', true);
  v_request public.service_requests%rowtype;
  v_min bigint := public.setting_int('min_order_price', 10000)::bigint;
  v_amount bigint;
  v_tier_label text;
begin
  select * into v_request
  from public.service_requests
  where id = p_request_id;

  if not found or v_request.mechanic_id is null then
    raise exception 'REQUEST_OR_MECHANIC_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_amount := greatest(coalesce(v_request.callout_fee_amount, v_min), v_min);
  v_tier_label := case v_request.callout_fee_tier
    when 'mobil' then 'Mobil'
    when 'derek' then 'Derek'
    else 'Motor'
  end;

  perform set_config('app.internal_rpc', '1', true);

  begin
    insert into public.order_invoice_items
      (request_id, mechanic_id, description, amount, item_type, is_locked)
    select
      p_request_id,
      v_request.mechanic_id,
      'Biaya panggil (' || v_tier_label || ')',
      v_amount,
      'callout_fee',
      true
    where not exists (
      select 1 from public.order_invoice_items oii
      where oii.request_id = p_request_id
        and oii.item_type = 'callout_fee'
        and oii.voided_at is null
    );
  exception when others then
    perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
    raise;
  end;

  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
  return v_amount;
end;
$$;

revoke all on function public.ensure_callout_invoice_item(uuid) from public, anon, authenticated;
grant execute on function public.ensure_callout_invoice_item(uuid) to service_role;

-- Hapus overload lama 8 parameter agar PostgREST memanggil versi 9 parameter secara deterministik.
drop function if exists public.create_service_request(
  uuid, text, text, double precision, double precision, text, text, text
);

create or replace function public.create_service_request(
  p_vehicle_id uuid default null,
  p_issue_description text default '',
  p_symptoms text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_address text default null,
  p_contact_phone text default '',
  p_additional_notes text default null,
  p_callout_fee_tier text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_issue text := btrim(coalesce(p_issue_description, ''));
  v_phone text := btrim(coalesce(p_contact_phone, ''));
  v_tier_input text := nullif(lower(btrim(coalesce(p_callout_fee_tier, ''))), '');
  v_vehicle_type text;
  v_tier text;
  v_min bigint := public.setting_int('min_order_price', 10000)::bigint;
  v_callout_amount bigint;
  v_request public.service_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if not public.has_role('client') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if char_length(v_issue) < 5 then
    raise exception 'INVALID_ISSUE_DESCRIPTION' using errcode = '22023';
  end if;
  if char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then
    raise exception 'INVALID_CONTACT_PHONE' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'INVALID_COORDINATES' using errcode = '22023';
  end if;

  if p_vehicle_id is not null then
    select v.type into v_vehicle_type
    from public.vehicles v
    where v.id = p_vehicle_id and v.owner_id = v_uid;

    if not found then
      raise exception 'INVALID_VEHICLE' using errcode = '42501';
    end if;
  end if;

  if v_tier_input is not null then
    if v_tier_input not in ('motor', 'mobil', 'derek') then
      raise exception 'INVALID_CALLOUT_TIER' using errcode = '22023';
    end if;
    v_tier := v_tier_input;
  elsif v_vehicle_type = 'mobil' then
    v_tier := 'mobil';
  else
    v_tier := 'motor';
  end if;

  v_callout_amount := greatest(
    v_min,
    case v_tier
      when 'mobil' then public.setting_int('callout_fee_mobil', 45000)::bigint
      when 'derek' then public.setting_int('callout_fee_derek', 100000)::bigint
      else public.setting_int('callout_fee_motor', 25000)::bigint
    end
  );

  perform pg_advisory_xact_lock(hashtextextended('client:' || v_uid::text, 0));

  if exists (
    select 1 from public.service_requests sr
    where sr.client_id = v_uid and sr.status not in ('paid', 'cancelled')
  ) then
    raise exception 'ACTIVE_ORDER_EXISTS' using errcode = 'P0001';
  end if;

  insert into public.service_requests (
    client_id, vehicle_id, issue_description, symptoms,
    lat, lng, address, contact_phone, additional_notes, status,
    callout_fee_tier, callout_fee_amount, quote_status
  ) values (
    v_uid,
    p_vehicle_id,
    v_issue,
    nullif(btrim(coalesce(p_symptoms, '')), ''),
    p_lat,
    p_lng,
    nullif(btrim(coalesce(p_address, '')), ''),
    v_phone,
    nullif(btrim(coalesce(p_additional_notes, '')), ''),
    'requested',
    v_tier,
    v_callout_amount,
    'draft'
  )
  returning * into v_request;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    v_request.id,
    null,
    'requested',
    v_uid,
    'Permintaan bantuan dibuat oleh client (tier biaya panggil: ' || v_tier || ', Rp' || v_callout_amount::text || ').'
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'request_created',
    'Membuat permintaan bantuan #' || upper(left(v_request.id::text, 8)) || '.',
    'service_request',
    v_request.id
  );

  perform public.notify_nearby_mechanics(v_request.id, null);

  return v_request;
end;
$$;

revoke all on function public.create_service_request(
  uuid, text, text, double precision, double precision, text, text, text, text
) from public, anon;
grant execute on function public.create_service_request(
  uuid, text, text, double precision, double precision, text, text, text, text
) to authenticated;

-- Perbarui transition_order_status agar otomatis membuat baris biaya panggil terkunci saat `arrived`.
create or replace function public.transition_order_status(
  p_request_id uuid,
  p_to_status text
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_to text := lower(btrim(coalesce(p_to_status, '')));
  v_short_id text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;

  if not (
    (v_request.status = 'mechanic_accepted' and v_to = 'on_the_way')
    or (v_request.status = 'on_the_way' and v_to = 'arrived')
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  v_short_id := upper(left(p_request_id::text, 8));

  update public.service_requests
  set status = v_to,
      arrived_at = case when v_to = 'arrived' then coalesce(arrived_at, now()) else arrived_at end,
      quote_status = case when v_to = 'arrived' then 'draft' else quote_status end,
      quote_expires_at = case when v_to = 'arrived' then null else quote_expires_at end,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  if v_to = 'arrived' then
    perform public.ensure_callout_invoice_item(p_request_id);
  end if;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    p_request_id,
    case when v_to = 'on_the_way' then 'mechanic_accepted' else 'on_the_way' end,
    v_to,
    v_uid,
    case when v_to = 'on_the_way' then 'Montir mulai menuju lokasi client.' else 'Montir tiba di lokasi client.' end
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    case when v_to = 'arrived' then 'order_arrived' else 'order_status' end,
    case
      when v_to = 'on_the_way' then 'Kamu mulai menuju lokasi order #' || v_short_id || '.'
      else 'Kamu tiba di lokasi order #' || v_short_id || '. Susun estimasi biaya untuk disetujui client.'
    end,
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    case when v_to = 'on_the_way' then 'Montir sedang menuju lokasimu' else 'Montir tiba di lokasi' end,
    case
      when v_to = 'on_the_way' then 'Pantau posisi montir secara langsung untuk pesanan #' || v_short_id || '.'
      else 'Montir sudah tiba di lokasi pesanan #' || v_short_id || '.'
    end,
    'order_status',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

-- ============ 5. DIGITAL APPROVAL RPCS DI DALAM `arrived` ============
create or replace function public.submit_order_quote(
  p_request_id uuid,
  p_photo_paths text[] default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_min bigint := public.setting_int('min_order_price', 10000)::bigint;
  v_max bigint := public.setting_int('max_order_price', 10000000)::bigint;
  v_expire_minutes integer := greatest(public.setting_int('quote_expire_minutes', 15), 1);
  v_total bigint;
  v_item_count integer;
  v_photos text[];
  v_path text;
  v_short_id text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;
  if v_request.status <> 'arrived' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if v_request.quote_status <> 'draft' then
    raise exception 'INVALID_QUOTE_STATUS' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payments where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  if p_photo_paths is not null then
    if coalesce(array_length(p_photo_paths, 1), 0) > 3 then
      raise exception 'TOO_MANY_QUOTE_PHOTOS' using errcode = '22023';
    end if;
    v_photos := '{}';
    foreach v_path in array p_photo_paths loop
      v_path := btrim(coalesce(v_path, ''));
      if v_path = '' or left(v_path, length(p_request_id::text) + 1) <> (p_request_id::text || '/') then
        raise exception 'INVALID_QUOTE_PHOTO_PATH' using errcode = '22023';
      end if;
      v_photos := array_append(v_photos, v_path);
    end loop;
  else
    v_photos := v_request.quote_photo_paths;
  end if;

  perform public.ensure_callout_invoice_item(p_request_id);

  select coalesce(sum(amount), 0)::bigint, count(*)::integer
  into v_total, v_item_count
  from public.order_invoice_items
  where request_id = p_request_id
    and voided_at is null;

  if v_item_count = 0 then
    raise exception 'NO_ITEMS' using errcode = 'P0001';
  end if;
  if v_total < v_min or v_total > v_max then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  update public.service_requests
  set quote_status = 'pending_approval',
      quote_submitted_at = now(),
      quote_expires_at = now() + make_interval(mins => v_expire_minutes),
      quote_revision_note = null,
      quote_photo_paths = coalesce(v_photos, '{}'),
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  v_short_id := upper(left(p_request_id::text, 8));

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    p_request_id,
    'arrived',
    'arrived',
    v_uid,
    'Montir mengirim estimasi biaya Rp' || v_total::text || ' (' || v_item_count::text || ' item) untuk persetujuan client.'
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'quote_submitted',
    'Mengirim estimasi order #' || v_short_id || ' sebesar Rp' || v_total::text || '.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Estimasi biaya siap disetujui',
    'Montir mengirim estimasi Rp' || v_total::text || ' untuk pesanan #' || v_short_id || '. Periksa rinciannya sebelum pengerjaan.',
    'quote_submitted',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

revoke all on function public.submit_order_quote(uuid, text[]) from public, anon;
grant execute on function public.submit_order_quote(uuid, text[]) to authenticated;

create or replace function public.withdraw_order_quote(p_request_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_short_id text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;
  if v_request.status <> 'arrived' or v_request.quote_status <> 'pending_approval' then
    raise exception 'INVALID_QUOTE_STATUS' using errcode = 'P0001';
  end if;

  update public.service_requests
  set quote_status = 'draft',
      quote_expires_at = null,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  v_short_id := upper(left(p_request_id::text, 8));

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'quote_withdrawn',
    'Menarik estimasi order #' || v_short_id || ' untuk diperbarui.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Montir memperbarui estimasi',
    'Montir menarik estimasi pesanan #' || v_short_id || ' untuk disesuaikan.',
    'quote_withdrawn',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

revoke all on function public.withdraw_order_quote(uuid) from public, anon;
grant execute on function public.withdraw_order_quote(uuid) to authenticated;

create or replace function public.respond_to_quote(
  p_request_id uuid,
  p_action text,
  p_note text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_internal text := current_setting('app.internal_rpc', true);
  v_uid uuid := auth.uid();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_note text := left(nullif(btrim(coalesce(p_note, '')), ''), 500);
  v_request public.service_requests%rowtype;
  v_callout_amount bigint;
  v_snapshot_items jsonb;
  v_short_id text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if v_action not in ('approve', 'request_revision', 'callout_only') then
    raise exception 'INVALID_QUOTE_ACTION' using errcode = '22023';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.client_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;
  if v_request.status <> 'arrived' or v_request.quote_status <> 'pending_approval' then
    raise exception 'INVALID_QUOTE_STATUS' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payments where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  v_short_id := upper(left(p_request_id::text, 8));

  if v_action = 'request_revision' then
    update public.service_requests
    set quote_status = 'draft',
        quote_expires_at = null,
        quote_revision_note = v_note,
        updated_at = now()
    where id = p_request_id
    returning * into v_request;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, changed_by, notes)
    values (
      p_request_id,
      'arrived',
      'arrived',
      v_uid,
      coalesce('Client meminta revisi estimasi: ' || v_note, 'Client meminta revisi estimasi.')
    );

    insert into public.activity_logs
      (user_id, activity_type, description, related_entity_type, related_entity_id)
    values (
      v_uid,
      'quote_revision_requested',
      'Meminta revisi estimasi untuk order #' || v_short_id || '.',
      'service_request',
      p_request_id
    );

    if v_request.mechanic_id is not null then
      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values (
        v_request.mechanic_id,
        'Client meminta revisi estimasi',
        case
          when v_note is not null then 'Catatan client untuk #' || v_short_id || ': ' || left(v_note, 140)
          else 'Client meminta penyesuaian rincian biaya untuk pesanan #' || v_short_id || '.'
        end,
        'quote_revision_requested',
        'service_request',
        p_request_id
      );
    end if;

    return v_request;
  end if;

  perform set_config('app.internal_rpc', '1', true);

  begin
    if v_action = 'approve' then
      update public.order_invoice_items
      set approved_at = coalesce(approved_at, now()),
          updated_at = now()
      where request_id = p_request_id
        and voided_at is null;

      update public.service_requests
      set quote_status = 'approved',
          quote_approved_at = now(),
          quote_expires_at = null,
          quote_revision_note = null,
          updated_at = now()
      where id = p_request_id
      returning * into v_request;

      insert into public.service_request_status_history
        (request_id, from_status, to_status, changed_by, notes)
      values (
        p_request_id,
        'arrived',
        'arrived',
        v_uid,
        'Client menyetujui estimasi biaya. Pengerjaan dilanjutkan.'
      );

      insert into public.activity_logs
        (user_id, activity_type, description, related_entity_type, related_entity_id)
      values (
        v_uid,
        'quote_approved',
        'Menyetujui estimasi biaya order #' || v_short_id || '.',
        'service_request',
        p_request_id
      );

      if v_request.mechanic_id is not null then
        insert into public.notifications
          (user_id, title, body, type, related_entity_type, related_entity_id)
        values (
          v_request.mechanic_id,
          'Estimasi disetujui client',
          'Client menyetujui estimasi pesanan #' || v_short_id || '. Silakan lanjutkan pengerjaan.',
          'quote_approved',
          'service_request',
          p_request_id
        );
      end if;
    else
      -- callout_only: simpan snapshot item yang ditolak, soft-void non-callout, kunci tagihan ke biaya panggil.
      v_callout_amount := public.ensure_callout_invoice_item(p_request_id);

      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', oii.id,
            'description', oii.description,
            'amount', oii.amount,
            'item_type', oii.item_type,
            'quote_photo_paths', oii.quote_photo_paths
          )
          order by oii.created_at asc
        ),
        '[]'::jsonb
      )
      into v_snapshot_items
      from public.order_invoice_items oii
      where oii.request_id = p_request_id
        and oii.item_type <> 'callout_fee'
        and oii.voided_at is null;

      update public.order_invoice_items
      set voided_at = now(),
          updated_at = now()
      where request_id = p_request_id
        and item_type <> 'callout_fee'
        and voided_at is null;

      update public.order_invoice_items
      set approved_at = coalesce(approved_at, now()),
          updated_at = now()
      where request_id = p_request_id
        and item_type = 'callout_fee'
        and voided_at is null;

      update public.service_requests
      set quote_status = 'callout_only',
          quote_approved_at = now(),
          quote_expires_at = null,
          quote_revision_note = v_note,
          rejected_quote_snapshot = jsonb_build_object(
            'rejected_at', now(),
            'reason', v_note,
            'callout_fee_amount', v_callout_amount,
            'items', v_snapshot_items,
            'quote_photo_paths', v_request.quote_photo_paths
          ),
          price_amount = v_callout_amount,
          status = 'payment',
          payment_method = null,
          updated_at = now()
      where id = p_request_id
      returning * into v_request;

      insert into public.service_request_status_history
        (request_id, from_status, to_status, changed_by, notes)
      values (
        p_request_id,
        'arrived',
        'payment',
        v_uid,
        'Client menolak estimasi perbaikan dan memilih bayar biaya panggil saja Rp' || v_callout_amount::text || '.'
      );

      insert into public.activity_logs
        (user_id, activity_type, description, related_entity_type, related_entity_id)
      values (
        v_uid,
        'quote_callout_only',
        'Memilih pembayaran biaya panggil saja untuk order #' || v_short_id || '.',
        'service_request',
        p_request_id
      );

      if v_request.mechanic_id is not null then
        insert into public.notifications
          (user_id, title, body, type, related_entity_type, related_entity_id)
        values (
          v_request.mechanic_id,
          'Client memilih biaya panggil saja',
          'Perbaikan pesanan #' || v_short_id || ' tidak dilanjutkan. Tagihan dikunci ke biaya panggil Rp' || v_callout_amount::text || '.',
          'quote_callout_only',
          'service_request',
          p_request_id
        );
      end if;
    end if;
  exception when others then
    perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
    raise;
  end;

  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
  return v_request;
end;
$$;

revoke all on function public.respond_to_quote(uuid, text, text) from public, anon;
grant execute on function public.respond_to_quote(uuid, text, text) to authenticated;

create or replace function public.request_quote_addon(
  p_request_id uuid,
  p_description text,
  p_amount bigint,
  p_item_type text default 'addon',
  p_photo_paths text[] default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_internal text := current_setting('app.internal_rpc', true);
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_desc text := btrim(coalesce(p_description, ''));
  v_type text := lower(btrim(coalesce(p_item_type, 'addon')));
  v_max bigint := public.setting_int('max_order_price', 10000000)::bigint;
  v_expire_minutes integer := greatest(public.setting_int('quote_expire_minutes', 15), 1);
  v_photos text[] := '{}';
  v_path text;
  v_total bigint;
  v_short_id text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if char_length(v_desc) = 0 then
    raise exception 'INVALID_ITEM_DESCRIPTION' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_PRICE' using errcode = '22023';
  end if;
  if v_type not in ('service', 'parts', 'addon') then
    raise exception 'INVALID_ITEM_TYPE' using errcode = '22023';
  end if;

  if p_photo_paths is not null then
    if coalesce(array_length(p_photo_paths, 1), 0) > 3 then
      raise exception 'TOO_MANY_QUOTE_PHOTOS' using errcode = '22023';
    end if;
    foreach v_path in array p_photo_paths loop
      v_path := btrim(coalesce(v_path, ''));
      if v_path = '' or left(v_path, length(p_request_id::text) + 1) <> (p_request_id::text || '/') then
        raise exception 'INVALID_QUOTE_PHOTO_PATH' using errcode = '22023';
      end if;
      v_photos := array_append(v_photos, v_path);
    end loop;
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;
  if v_request.status <> 'arrived' or v_request.quote_status <> 'approved' then
    raise exception 'INVALID_QUOTE_STATUS' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payments where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0)::bigint + p_amount into v_total
  from public.order_invoice_items
  where request_id = p_request_id
    and voided_at is null;

  if v_total > v_max then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  perform set_config('app.internal_rpc', '1', true);

  begin
    insert into public.order_invoice_items
      (request_id, mechanic_id, description, amount, item_type, is_locked, approved_at, quote_photo_paths)
    values
      (p_request_id, v_uid, v_desc, p_amount, v_type, false, null, v_photos);

    update public.service_requests
    set quote_status = 'pending_approval',
        quote_submitted_at = now(),
        quote_expires_at = now() + make_interval(mins => v_expire_minutes),
        updated_at = now()
    where id = p_request_id
    returning * into v_request;
  exception when others then
    perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
    raise;
  end;

  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);

  v_short_id := upper(left(p_request_id::text, 8));

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    p_request_id,
    'arrived',
    'arrived',
    v_uid,
    'Montir mengajukan biaya tambahan: ' || v_desc || ' (Rp' || p_amount::text || ').'
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'quote_addon_requested',
    'Mengajukan item tambahan order #' || v_short_id || ': ' || v_desc || '.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Ada biaya tambahan yang perlu disetujui',
    'Montir mengajukan tambahan "' || left(v_desc, 80) || '" (Rp' || p_amount::text || ') untuk pesanan #' || v_short_id || '.',
    'quote_addon_requested',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

revoke all on function public.request_quote_addon(uuid, text, bigint, text, text[]) from public, anon;
grant execute on function public.request_quote_addon(uuid, text, bigint, text, text[]) to authenticated;

-- Perbarui finalize_order_invoice: wajib sudah disetujui (`approved` / `callout_only`).
create or replace function public.finalize_order_invoice(p_request_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_min bigint := public.setting_int('min_order_price', 10000)::bigint;
  v_max bigint := public.setting_int('max_order_price', 10000000)::bigint;
  v_total bigint;
  v_item_count integer;
  v_prev_status text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;
  if v_request.status <> 'arrived' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if v_request.quote_status not in ('approved', 'callout_only') then
    raise exception 'QUOTE_NOT_APPROVED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payments where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  perform public.ensure_callout_invoice_item(p_request_id);

  if exists (
    select 1 from public.order_invoice_items
    where request_id = p_request_id
      and voided_at is null
      and approved_at is null
  ) then
    raise exception 'QUOTE_NOT_APPROVED' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0)::bigint, count(*)::integer
  into v_total, v_item_count
  from public.order_invoice_items
  where request_id = p_request_id
    and voided_at is null;

  if v_item_count = 0 then
    raise exception 'NO_ITEMS' using errcode = 'P0001';
  end if;
  if v_total < v_min or v_total > v_max then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
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
  values (
    p_request_id,
    v_prev_status,
    'payment',
    v_uid,
    'Montir mengirim tagihan terperinci ' || v_total::text || ' IDR (' || v_item_count::text || ' baris).'
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'invoice_sent',
    'Tagihan terperinci order #' || upper(left(p_request_id::text, 8)) ||
      ' sebesar Rp' || v_total::text || ' (' || v_item_count::text || ' baris) dikirim ke client.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Tagihan perbaikan siap dibayar',
    'Montir mengirim tagihan terperinci untuk order #' || upper(left(p_request_id::text, 8)) ||
      '. Buka detail order untuk melihat rincian dan membayar.',
    'payment',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

-- Perbarui reopen_order_invoice: reset ke `arrived` + `quote_status = 'draft'` (wajib persetujuan ulang) & blokir bila `callout_only`.
create or replace function public.reopen_order_invoice(p_request_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_internal text := current_setting('app.internal_rpc', true);
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_short_id text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;
  if v_request.status <> 'payment' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if v_request.quote_status = 'callout_only' then
    raise exception 'CALLOUT_ONLY_LOCKED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payments where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  update public.payments
  set status = 'cancelled',
      updated_at = now()
  where request_id = p_request_id
    and status = 'pending';

  perform set_config('app.internal_rpc', '1', true);

  begin
    update public.order_invoice_items
    set approved_at = null,
        updated_at = now()
    where request_id = p_request_id
      and item_type <> 'callout_fee'
      and voided_at is null;

    update public.service_requests
    set status = 'arrived',
        quote_status = 'draft',
        quote_expires_at = null,
        quote_approved_at = null,
        price_amount = null,
        payment_method = null,
        updated_at = now()
    where id = p_request_id
    returning * into v_request;
  exception when others then
    perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
    raise;
  end;

  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);

  v_short_id := upper(left(p_request_id::text, 8));

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    p_request_id,
    'payment',
    'arrived',
    v_uid,
    'Montir membuka ulang tagihan untuk revisi (memerlukan persetujuan ulang client).'
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'invoice_reopened',
    'Membuka ulang tagihan order #' || v_short_id || ' untuk revisi.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Tagihan sedang direvisi montir',
    'Montir memperbarui rincian tagihan pesanan #' || v_short_id || ' dan akan mengirim ulang untuk persetujuan.',
    'payment',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

-- Perbarui cancel_order: escape hatch saat client tidak merespons quote setelah quote_expires_at + wajib alasan di arrived.
create or replace function public.cancel_order(
  p_request_id uuid,
  p_reason text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_short_id text;
  v_prev_status text;
  v_mech_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_prev_status := v_request.status;
  v_mech_id := v_request.mechanic_id;
  v_short_id := upper(left(p_request_id::text, 8));

  -- 1. Pembatalan oleh client: diizinkan sebelum montir tiba (`arrived`).
  if v_request.client_id = v_uid then
    if v_prev_status not in ('requested', 'mechanic_assigned', 'mechanic_accepted', 'on_the_way') then
      raise exception 'CANNOT_CANCEL_AT_STAGE' using errcode = 'P0001';
    end if;

    perform set_config('app.internal_rpc', '1', true);

    update public.service_requests
    set status = 'cancelled',
        updated_at = now()
    where id = p_request_id
    returning * into v_request;

    if v_mech_id is not null then
      update public.mechanic_profiles
      set is_available = true
      where profile_id = v_mech_id;

      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values (
        v_mech_id,
        'Pesanan dibatalkan client',
        'Pesanan #' || v_short_id || ' dibatalkan oleh client' ||
          case when v_reason is not null then ': ' || left(v_reason, 120) else '.' end,
        'order_cancelled',
        'service_request',
        p_request_id
      );
    end if;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, changed_by, notes)
    values (
      p_request_id,
      v_prev_status,
      'cancelled',
      v_uid,
      coalesce('Dibatalkan client: ' || v_reason, 'Dibatalkan oleh client.')
    );

    insert into public.activity_logs
      (user_id, activity_type, description, related_entity_type, related_entity_id)
    values (
      v_uid,
      'order_cancelled',
      'Membatalkan pesanan #' || v_short_id || '.',
      'service_request',
      p_request_id
    );

    return v_request;
  end if;

  -- 2. Pembatalan oleh montir.
  if v_request.mechanic_id = v_uid then
    perform set_config('app.internal_rpc', '1', true);

    if v_prev_status in ('mechanic_accepted', 'on_the_way') then
      insert into public.service_request_assignment_rejections (request_id, mechanic_id, client_id)
      values (p_request_id, v_uid, v_request.client_id)
      on conflict do nothing;

      update public.service_requests
      set status = 'requested',
          mechanic_id = null,
          accepted_at = null,
          assignment_requested_at = null,
          assignment_expires_at = null,
          updated_at = now()
      where id = p_request_id
      returning * into v_request;

      update public.mechanic_profiles
      set is_available = true
      where profile_id = v_uid;

      insert into public.service_request_status_history
        (request_id, from_status, to_status, changed_by, notes)
      values (
        p_request_id,
        v_prev_status,
        'requested',
        v_uid,
        coalesce('Montir membatalkan (' || v_reason || '). Pesanan mencari montir lain.',
                 'Montir membatalkan sebelum tiba. Pesanan kembali mencari montir.')
      );

      insert into public.activity_logs
        (user_id, activity_type, description, related_entity_type, related_entity_id)
      values (
        v_uid,
        'order_cancelled',
        'Membatalkan order #' || v_short_id || case when v_reason is not null then ' (' || v_reason || ')' else '' end || '.',
        'service_request',
        p_request_id
      );

      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values (
        v_request.client_id,
        'Montir membatalkan pesanan',
        'Pesanan #' || v_short_id || ' dikembalikan ke pencarian montir terdekat' ||
          case when v_reason is not null then ' (alasan: ' || left(v_reason, 100) || ').' else '.' end,
        'order_reopened',
        'service_request',
        p_request_id
      );

      perform public.notify_nearby_mechanics(p_request_id, v_uid);
      return v_request;
    end if;

    if v_prev_status = 'arrived' then
      if v_reason is null then
        raise exception 'CANCEL_REASON_REQUIRED' using errcode = '22023';
      end if;

      if v_request.quote_status = 'pending_approval'
         and v_request.quote_expires_at is not null
         and v_request.quote_expires_at > now() then
        raise exception 'QUOTE_APPROVAL_PENDING' using errcode = 'P0001';
      end if;

      update public.service_requests
      set status = 'cancelled',
          quote_expires_at = null,
          updated_at = now()
      where id = p_request_id
      returning * into v_request;

      update public.mechanic_profiles
      set is_available = true
      where profile_id = v_uid;

      insert into public.service_request_status_history
        (request_id, from_status, to_status, changed_by, notes)
      values (
        p_request_id,
        v_prev_status,
        'cancelled',
        v_uid,
        'Dibatalkan montir: ' || v_reason
      );

      insert into public.activity_logs
        (user_id, activity_type, description, related_entity_type, related_entity_id)
      values (
        v_uid,
        'order_cancelled',
        'Membatalkan order #' || v_short_id || ' (' || v_reason || ').',
        'service_request',
        p_request_id
      );

      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values (
        v_request.client_id,
        'Pesanan dibatalkan montir',
        'Pesanan #' || v_short_id || ' dibatalkan oleh montir: ' || left(v_reason, 120),
        'order_cancelled',
        'service_request',
        p_request_id
      );

      return v_request;
    end if;

    raise exception 'CANNOT_CANCEL_AT_STAGE' using errcode = 'P0001';
  end if;

  raise exception 'NOT_ORDER_PARTICIPANT' using errcode = '42501';
end;
$$;

-- ============ 6. KECUALIKAN `callout_only` DARI `total_jobs` ============
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
        and coalesce(sr.quote_status, 'approved') <> 'callout_only'
    )
    where mp.profile_id = p_mechanic_id;
  exception when others then
    perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
    raise;
  end;

  perform set_config('app.internal_rpc', coalesce(v_prev_internal, ''), true);
end;
$$;

-- ============ 7. BUCKET PRIVAT `quote-photos` + RLS + RETENSI ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-photos',
  'quote-photos',
  false,
  524288,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 524288,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create or replace function public.quote_photo_accessible(
  p_path text,
  p_for_write boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[] := storage.foldername(p_path);
  v_req_text text := v_parts[1];
  v_owner_text text := v_parts[2];
  v_req_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;
  if public.has_role('admin') then
    return true;
  end if;
  if v_req_text is null
     or v_req_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;
  v_req_id := v_req_text::uuid;

  if p_for_write then
    if v_owner_text is distinct from auth.uid()::text then
      return false;
    end if;
    return exists (
      select 1 from public.service_requests sr
      where sr.id = v_req_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
    );
  end if;

  return exists (
    select 1 from public.service_requests sr
    where sr.id = v_req_id
      and (sr.client_id = auth.uid() or sr.mechanic_id = auth.uid())
  );
end;
$$;

revoke all on function public.quote_photo_accessible(text, boolean) from public, anon;
grant execute on function public.quote_photo_accessible(text, boolean) to authenticated;

drop policy if exists quote_storage_select on storage.objects;
create policy quote_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'quote-photos'
    and public.quote_photo_accessible(name, false)
  );

drop policy if exists quote_storage_insert on storage.objects;
create policy quote_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'quote-photos'
    and public.quote_photo_accessible(name, true)
  );

drop policy if exists quote_storage_delete on storage.objects;
create policy quote_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'quote-photos'
    and public.quote_photo_accessible(name, true)
  );

-- Perbarui cleanup retensi agar ikut membersihkan `quote-photos` > 90 hari pada order terminal tanpa komplain aktif.
create or replace function public.cleanup_old_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loc_deleted integer := 0;
  v_notif_deleted integer := 0;
  v_act_deleted integer := 0;
  v_ai_deleted integer := 0;
  v_quote_photos_deleted integer := 0;
begin
  delete from public.mechanic_locations
  where recorded_at < now() - interval '30 days';
  get diagnostics v_loc_deleted = row_count;

  delete from public.notifications
  where is_read = true
    and created_at < now() - interval '90 days';
  get diagnostics v_notif_deleted = row_count;

  delete from public.activity_logs
  where created_at < now() - interval '180 days';
  get diagnostics v_act_deleted = row_count;

  delete from public.ai_usage_logs
  where created_at < now() - interval '30 days';
  get diagnostics v_ai_deleted = row_count;

  delete from storage.objects obj
  where obj.bucket_id = 'quote-photos'
    and obj.created_at < now() - interval '90 days'
    and (storage.foldername(obj.name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and exists (
      select 1 from public.service_requests sr
      where sr.id = ((storage.foldername(obj.name))[1])::uuid
        and sr.status in ('paid', 'cancelled')
        and not exists (
          select 1 from public.complaints c
          where c.request_id = sr.id
            and c.status in ('open', 'in_progress')
        )
    );
  get diagnostics v_quote_photos_deleted = row_count;

  return jsonb_build_object(
    'mechanic_locations_deleted', v_loc_deleted,
    'notifications_deleted', v_notif_deleted,
    'activity_logs_deleted', v_act_deleted,
    'ai_usage_logs_deleted', v_ai_deleted,
    'quote_photos_deleted', v_quote_photos_deleted
  );
end;
$$;

-- ============ 8. KENDARAAN MONTIR OPSIONAL (EKSPOSE PASCA-PENUGASAN SAJA) ============
alter table public.mechanic_profiles
  add column if not exists vehicle_label text,
  add column if not exists vehicle_plate text;

alter table public.mechanic_profiles
  drop constraint if exists mp_vehicle_label_len_check,
  add constraint mp_vehicle_label_len_check
    check (vehicle_label is null or char_length(btrim(vehicle_label)) <= 80);

alter table public.mechanic_profiles
  drop constraint if exists mp_vehicle_plate_len_check,
  add constraint mp_vehicle_plate_len_check
    check (vehicle_plate is null or char_length(btrim(vehicle_plate)) <= 20);

-- Pastikan view pasca-penugasan `mechanic_assignment_profile` mengekspose vehicle_label & vehicle_plate
-- (TIDAK ditambahkan ke `mechanic_directory` atau `list_nearby_mechanics`).
create or replace view public.mechanic_assignment_profile
with (security_invoker = false)
as
select
  mp.profile_id,
  p.full_name,
  p.avatar_url,
  mp.workshop_name,
  mp.workshop_address,
  mp.bio,
  mp.experience_years,
  mp.skills,
  mp.vehicle_specialization,
  mp.certifications,
  mp.workshop_photos[1] as workshop_photo,
  mp.rating_avg,
  mp.rating_count,
  mp.total_jobs,
  mp.is_verified,
  mp.verified_at,
  mp.vehicle_label,
  mp.vehicle_plate
from public.mechanic_profiles mp
join public.profiles p on p.id = mp.profile_id
where exists (
  select 1
  from public.service_requests sr
  where sr.mechanic_id = mp.profile_id
    and sr.client_id = auth.uid()
);

revoke all on public.mechanic_assignment_profile from public, anon;
grant select on public.mechanic_assignment_profile to authenticated;

create or replace view public.assigned_order_mechanic_view
with (security_invoker = false)
as
select
  sr.id as request_id,
  mp.profile_id as mechanic_id,
  p.full_name,
  p.phone_number,
  p.avatar_url,
  mp.workshop_name,
  mp.workshop_address,
  mp.rating_avg,
  mp.rating_count,
  mp.total_jobs,
  mp.is_verified,
  mp.vehicle_label,
  mp.vehicle_plate
from public.service_requests sr
join public.mechanic_profiles mp on mp.profile_id = sr.mechanic_id
join public.profiles p on p.id = mp.profile_id
where sr.mechanic_id is not null
  and sr.status <> 'requested'
  and (
    sr.client_id = auth.uid()
    or sr.mechanic_id = auth.uid()
    or public.has_role('admin')
  );

revoke all on public.assigned_order_mechanic_view from public, anon;
grant select on public.assigned_order_mechanic_view to authenticated;

-- Perbarui admin_transaction_overview (mempertahankan urutan kolom lama, memfilter voided_at is null, menambah kolom baru di akhir).
create or replace view public.admin_transaction_overview
with (security_invoker = true)
as
select
  sr.id,
  sr.status,
  sr.issue_description,
  sr.symptoms,
  sr.address,
  sr.lat,
  sr.lng,
  sr.contact_phone,
  sr.additional_notes,
  sr.price_amount,
  sr.currency,
  sr.payment_method,
  sr.created_at,
  sr.accepted_at,
  sr.arrived_at,
  sr.completed_at,
  sr.client_id,
  c.full_name as client_name,
  c.email as client_email,
  c.phone_number as client_phone,
  sr.mechanic_id,
  m.full_name as mechanic_name,
  m.email as mechanic_email,
  m.phone_number as mechanic_phone,
  sr.vehicle_id,
  v.type as vehicle_type,
  v.brand as vehicle_brand,
  v.model as vehicle_model,
  v.license_plate,
  pay.id as payment_id,
  pay.amount as payment_amount,
  pay.platform_fee,
  pay.net_amount,
  pay.method as payment_method_used,
  pay.status as payment_status,
  pay.paid_at,
  coalesce(inv.item_count, 0)::bigint as invoice_item_count,
  coalesce(inv.invoice_total, 0)::bigint as invoice_total,
  sr.callout_fee_tier,
  sr.callout_fee_amount,
  sr.quote_status
from public.service_requests sr
left join public.profiles c on c.id = sr.client_id
left join public.profiles m on m.id = sr.mechanic_id
left join public.vehicles v on v.id = sr.vehicle_id
left join lateral (
  select p.id, p.amount, p.platform_fee, p.net_amount, p.method, p.status, p.paid_at
  from public.payments p
  where p.request_id = sr.id
  order by (p.status = 'paid') desc, p.created_at desc
  limit 1
) pay on true
left join lateral (
  select count(*) as item_count, coalesce(sum(oii.amount), 0) as invoice_total
  from public.order_invoice_items oii
  where oii.request_id = sr.id
    and oii.voided_at is null
) inv on true
where public.has_role('admin');

revoke all on public.admin_transaction_overview from public, anon;
grant select on public.admin_transaction_overview to authenticated;

notify pgrst, 'reload schema';
