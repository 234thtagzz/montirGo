-- MontirGo Phase 1: P0 Security, PII Privacy, RLS Hardening & Schema Cleanup.
-- Prasyarat: 20261015000000..20261121010000.
-- Idempotent & aman dijalankan ulang maupun dari awal (`supabase db reset`).

-- ============ 1. ISOLASI NIK KE profile_identities ============

-- Backfill NIK valid dari profiles / mechanic_profiles sebelum kolom dihapus.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'identity_number'
  ) then
    execute $mig$
      insert into public.profile_identities (profile_id, identity_number)
      select p.id, p.identity_number
      from public.profiles p
      where p.identity_number ~ '^[0-9]{16}$'
        and not exists (
          select 1 from public.profile_identities pi
          where pi.profile_id = p.id or pi.identity_number = p.identity_number
        )
      on conflict (profile_id) do nothing
    $mig$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'mechanic_profiles' and column_name = 'identity_number'
  ) then
    execute $mig$
      insert into public.profile_identities (profile_id, identity_number)
      select mp.profile_id, mp.identity_number
      from public.mechanic_profiles mp
      where mp.identity_number ~ '^[0-9]{16}$'
        and not exists (
          select 1 from public.profile_identities pi
          where pi.profile_id = mp.profile_id or pi.identity_number = mp.identity_number
        )
      on conflict (profile_id) do nothing
    $mig$;
  end if;
end $$;

-- Lepas view admin sebelum mengubah/menghapus kolom terkait (dibuat ulang di bagian akhir).
drop view if exists public.admin_user_directory;
drop view if exists public.admin_transaction_overview;
drop view if exists public.admin_complaint_overview;

-- Hapus dual-sync triggers & functions agar NIK tidak pernah tersalin ke profiles.
drop trigger if exists trg_sync_identity_to_profile on public.profile_identities;
drop trigger if exists trg_sync_profile_to_identity on public.profiles;
drop trigger if exists trg_prevent_profile_identity_change on public.profiles;
drop function if exists public.sync_identity_to_profile();
drop function if exists public.sync_profile_to_identity();
drop function if exists public.prevent_profile_identity_number_change();

alter table if exists public.profiles drop column if exists identity_number;
alter table if exists public.mechanic_profiles drop column if exists identity_number;

-- Perbarui trigger signup: simpan NIK hanya ke profile_identities.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce((new.raw_user_meta_data ->> 'role'), 'client');
  v_identity_number text := nullif(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'identity_number', ''), '[^0-9]', '', 'g'),
    ''
  );
begin
  if v_role not in ('client', 'mechanic') then
    v_role := 'client';
  end if;

  insert into public.profiles (id, email, full_name, phone_number, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'phone',
    v_role::public.app_role
  )
  on conflict (id) do nothing;

  if v_identity_number is not null and v_identity_number ~ '^[0-9]{16}$' then
    begin
      insert into public.profile_identities (profile_id, identity_number)
      values (new.id, v_identity_number)
      on conflict (profile_id) do nothing;
    exception when unique_violation then
      raise exception 'IDENTITY_NUMBER_ALREADY_USED' using errcode = '23505';
    end;
  end if;

  return new;
end;
$$;

-- Perketat profiles_insert_own: user tidak pernah boleh insert dirinya sebagai admin/mechanic langsung.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'client'::public.app_role);

-- RPC pengisian NIK sekali seumur hidup untuk akun lama.
create or replace function public.set_my_identity_number(p_identity_number text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := regexp_replace(coalesce(p_identity_number, ''), '[^0-9]', '', 'g');
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  if v_clean !~ '^[0-9]{16}$' then
    raise exception 'INVALID_IDENTITY_NUMBER' using errcode = '22023';
  end if;

  if exists (select 1 from public.profile_identities where profile_id = v_uid) then
    raise exception 'IDENTITY_ALREADY_SET' using errcode = 'P0001';
  end if;

  begin
    insert into public.profile_identities (profile_id, identity_number)
    values (v_uid, v_clean);
  exception when unique_violation then
    raise exception 'IDENTITY_NUMBER_ALREADY_USED' using errcode = '23505';
  end;
end;
$$;

revoke all on function public.set_my_identity_number(text) from public, anon;
grant execute on function public.set_my_identity_number(text) to authenticated;

-- ============ 2. PROTEKSI mechanic_profiles (PRIVASI & ANTI SELF-VERIFY) ============

-- Tutup baca langsung mechanic_profiles ke seluruh user login (client baca lewat mechanic_directory / RPC aman).
drop policy if exists mp_select_visible on public.mechanic_profiles;
drop policy if exists mp_select_own_or_admin on public.mechanic_profiles;
create policy mp_select_own_or_admin on public.mechanic_profiles
  for select to authenticated
  using (profile_id = auth.uid() or public.has_role('admin'));

create or replace function public.protect_mechanic_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Izinkan migrasi, trigger internal, service_role, RPC terpercaya, dan admin.
  if auth.uid() is null
     or current_setting('app.internal_rpc', true) = '1'
     or public.has_role('admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_verified, false)
       or new.verified_at is not null
       or new.verified_by is not null
       or coalesce(new.rating_avg, 0) <> 0
       or coalesce(new.rating_count, 0) <> 0
       or coalesce(new.total_jobs, 0) <> 0
       or coalesce(new.is_online, false) then
      raise exception 'PROTECTED_COLUMN' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_verified is distinct from old.is_verified
     or new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or new.total_jobs is distinct from old.total_jobs
     or new.is_available is distinct from old.is_available then
    raise exception 'PROTECTED_COLUMN' using errcode = '42501';
  end if;

  if new.is_online = true and old.is_verified = false then
    raise exception 'MECHANIC_NOT_VERIFIED' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_mechanic_profile_columns on public.mechanic_profiles;
create trigger trg_protect_mechanic_profile_columns
  before insert or update on public.mechanic_profiles
  for each row execute function public.protect_mechanic_profile_columns();

-- ============ 3. TUTUP DIRECT UPDATE service_requests & DROP set_order_price ============

drop policy if exists sr_mechanic_accept on public.service_requests;
drop policy if exists sr_mechanic_progress on public.service_requests;
drop policy if exists sr_update_client_cancel on public.service_requests;
drop policy if exists sr_select_open_for_mechanics on public.service_requests;

drop function if exists public.set_order_price(uuid, integer);

-- ============ 4. PERBAIKI BUG FATAL TABEL complaints ============

-- Lepas CHECK constraint lama yang memanggil current_role() (memblokir UPDATE oleh admin/service_role).
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.complaints'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%current_role%'
  loop
    execute format('alter table public.complaints drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.complaints alter column reporter_role drop default;
alter table public.complaints drop constraint if exists complaints_reporter_role_check;
alter table public.complaints add constraint complaints_reporter_role_check
  check (reporter_role in ('client', 'mechanic'));

create or replace function public.complaints_prepare_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null or public.has_role('admin') then
    return new;
  end if;

  v_role := public.current_role();
  if v_role not in ('client', 'mechanic') then
    raise exception 'INVALID_REPORTER_ROLE' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.service_requests sr
    where sr.id = new.request_id
      and (
        (v_role = 'client' and sr.client_id = v_uid)
        or (v_role = 'mechanic' and sr.mechanic_id = v_uid)
      )
  ) then
    raise exception 'NOT_ORDER_PARTICIPANT' using errcode = '42501';
  end if;

  new.reporter_id := v_uid;
  new.reporter_role := v_role;
  new.status := 'open';
  new.admin_reply := null;
  new.resolved_by := null;
  new.resolved_at := null;
  return new;
end;
$$;

create or replace function public.complaints_prepare_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reporter_id is distinct from old.reporter_id
     or new.reporter_role is distinct from old.reporter_role
     or new.request_id is distinct from old.request_id then
    raise exception 'IMMUTABLE_COMPLAINT_FIELDS' using errcode = '42501';
  end if;

  if new.status in ('resolved', 'closed')
     and old.status not in ('resolved', 'closed') then
    new.resolved_by := coalesce(new.resolved_by, auth.uid());
    new.resolved_at := coalesce(new.resolved_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_complaints_prepare_insert on public.complaints;
create trigger trg_complaints_prepare_insert
  before insert on public.complaints
  for each row execute function public.complaints_prepare_insert();

drop trigger if exists trg_complaints_prepare_update on public.complaints;
create trigger trg_complaints_prepare_update
  before update on public.complaints
  for each row execute function public.complaints_prepare_update();

drop policy if exists complaint_reporter_insert on public.complaints;
create policy complaint_reporter_insert on public.complaints
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and admin_reply is null
    and resolved_by is null
    and resolved_at is null
  );

drop policy if exists complaint_admin_all on public.complaints;
create policy complaint_admin_all on public.complaints
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists complaint_storage_delete_own on storage.objects;
create policy complaint_storage_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============ 5. PERBAIKI STORAGE RLS (vehicle-photos & workshop-photos) ============

create or replace function public.vehicle_photo_visible(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehicles v
    left join public.service_requests sr on sr.vehicle_id = v.id
    where v.photo_url = p_path
      and (
        v.owner_id = auth.uid()
        or public.has_role('admin')
        or sr.mechanic_id = auth.uid()
        or (
          sr.mechanic_id is null
          and sr.status in ('requested', 'matching')
          and public.has_role('mechanic')
          and exists (
            select 1
            from public.mechanic_profiles mp
            where mp.profile_id = auth.uid()
              and mp.is_verified = true
          )
        )
      )
  );
$$;

create or replace function public.workshop_photo_visible(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner_text text := (storage.foldername(p_path))[1];
  v_owner uuid;
begin
  if v_owner_text is null
     or v_owner_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return false;
  end if;

  v_owner := v_owner_text::uuid;

  if v_owner = auth.uid() or public.has_role('admin') then
    return true;
  end if;

  -- Foto sampul utama (elemen ke-1) montir online & verified boleh dibaca user login untuk direktori Beranda.
  if exists (
    select 1
    from public.mechanic_profiles mp
    where mp.profile_id = v_owner
      and mp.is_online = true
      and mp.is_verified = true
      and mp.workshop_photos[1] = p_path
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.service_requests sr
    where sr.mechanic_id = v_owner
      and sr.client_id = auth.uid()
  );
end;
$$;

revoke all on function public.workshop_photo_visible(text) from public;
grant execute on function public.workshop_photo_visible(text) to authenticated;

drop policy if exists storage_workshop_photo_read on storage.objects;
create policy storage_workshop_photo_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workshop-photos'
    and public.workshop_photo_visible(name)
  );

-- ============ 6. PERAPIHAN SKEMA & STANDARISASI TIPE ============

drop table if exists public.locations cascade;

-- Rename kolom order_invoice_items: keterangan -> description, harga -> amount.
do $$
declare
  r record;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_invoice_items' and column_name = 'keterangan'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_invoice_items' and column_name = 'description'
  ) then
    execute 'alter table public.order_invoice_items rename column keterangan to description';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_invoice_items' and column_name = 'harga'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_invoice_items' and column_name = 'amount'
  ) then
    execute 'alter table public.order_invoice_items rename column harga to amount';
  end if;

  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.order_invoice_items'::regclass
      and contype = 'c'
  loop
    execute format('alter table public.order_invoice_items drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.order_invoice_items
  alter column amount type bigint using amount::bigint;

alter table public.order_invoice_items
  add constraint order_invoice_items_description_check
    check (char_length(btrim(description)) > 0),
  add constraint order_invoice_items_amount_check
    check (amount > 0);

-- Seragamkan seluruh kolom moneter menjadi BIGINT.
alter table public.service_requests
  alter column price_amount type bigint using price_amount::bigint;

alter table public.payments
  alter column amount type bigint using amount::bigint,
  alter column platform_fee type bigint using platform_fee::bigint,
  alter column net_amount type bigint using net_amount::bigint;

alter table public.earnings
  alter column gross_amount type bigint using gross_amount::bigint,
  alter column platform_fee type bigint using platform_fee::bigint,
  alter column net_amount type bigint using net_amount::bigint;

-- Normalisasi status legacy sebelum menerapkan constraint 8 status resmi.
update public.service_requests set status = 'requested' where status = 'matching';
update public.service_requests set status = 'arrived' where status in ('diagnosing', 'repairing', 'completed');

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.service_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.service_requests drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.service_requests
  add constraint service_requests_status_check
  check (status in (
    'requested',
    'mechanic_assigned',
    'mechanic_accepted',
    'on_the_way',
    'arrived',
    'payment',
    'paid',
    'cancelled'
  ));

-- ============ 7. BANGUN ULANG VIEW ADMIN TANPA N+1 SUBQUERY ============

create or replace view public.admin_user_directory
with (security_invoker = true)
as
select
  p.id,
  p.role::text as role,
  p.full_name,
  p.email,
  p.phone_number,
  p.avatar_url,
  pi.identity_number,
  p.created_at,
  p.updated_at,
  mp.workshop_name,
  mp.workshop_address,
  mp.bio,
  mp.experience_years,
  mp.skills,
  mp.vehicle_specialization,
  mp.certifications,
  mp.is_online,
  mp.is_available,
  mp.is_verified,
  mp.verified_at,
  mp.rating_avg,
  mp.rating_count,
  mp.total_jobs,
  mp.current_lat,
  mp.current_lng,
  mp.last_location_at,
  coalesce(vc.cnt, 0)::bigint as vehicle_count,
  coalesce(src.cnt, 0)::bigint as client_request_count,
  coalesce(srm.cnt, 0)::bigint as mechanic_request_count,
  coalesce(sp.total_spent, 0)::bigint as total_spent,
  coalesce(er.total_earned, 0)::bigint as total_earned
from public.profiles p
left join public.profile_identities pi on pi.profile_id = p.id
left join public.mechanic_profiles mp on mp.profile_id = p.id
left join lateral (
  select count(*) as cnt from public.vehicles v where v.owner_id = p.id
) vc on true
left join lateral (
  select count(*) as cnt from public.service_requests sr where sr.client_id = p.id
) src on true
left join lateral (
  select count(*) as cnt from public.service_requests sr where sr.mechanic_id = p.id
) srm on true
left join lateral (
  select coalesce(sum(pay.amount), 0) as total_spent
  from public.payments pay
  join public.service_requests sr on sr.id = pay.request_id
  where sr.client_id = p.id and pay.status = 'paid'
) sp on true
left join lateral (
  select coalesce(sum(e.net_amount), 0) as total_earned
  from public.earnings e
  where e.mechanic_id = p.id
) er on true
where public.has_role('admin');

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
  coalesce(inv.invoice_total, 0)::bigint as invoice_total
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
) inv on true
where public.has_role('admin');

create or replace view public.admin_complaint_overview
with (security_invoker = true)
as
select
  c.id,
  c.reporter_id,
  c.reporter_role,
  rp.full_name as reporter_name,
  rp.email as reporter_email,
  rp.phone_number as reporter_phone,
  c.category,
  c.subject,
  c.description,
  c.photo_paths,
  c.status,
  c.admin_reply,
  c.resolved_by,
  c.resolved_at,
  c.created_at,
  c.updated_at,
  c.request_id,
  r.issue_description as order_issue,
  r.status as order_status,
  r.created_at as order_created_at
from public.complaints c
join public.service_requests r on r.id = c.request_id
join public.profiles rp on rp.id = c.reporter_id
where public.has_role('admin');

revoke all on public.admin_user_directory from public, anon;
revoke all on public.admin_transaction_overview from public, anon;
revoke all on public.admin_complaint_overview from public, anon;
grant select on public.admin_user_directory to authenticated;
grant select on public.admin_transaction_overview to authenticated;
grant select on public.admin_complaint_overview to authenticated;

notify pgrst, 'reload schema';
