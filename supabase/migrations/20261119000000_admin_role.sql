-- MontirGo — Role admin first-class + hak CRUD penuh.
--
-- Tujuan:
--   1. Database memiliki tepat tiga role: 'client', 'mechanic', 'admin'
--      (didefinisikan sebagai enum public.app_role).
--   2. Signup aplikasi mobile tetap hanya boleh 'client' / 'mechanic'.
--      Role 'admin' tidak pernah bisa dibuat dari aplikasi.
--   3. Role admin mendapat SELECT + INSERT + UPDATE + DELETE (CRUD) pada
--      seluruh tabel data, termasuk data montir, client, dan transaksi.
--   4. Admin mendapat view informasi lengkap (user directory + transaksi).
--   5. Tersedia RPC provisioning role yang aman (service_role / admin).
--
-- Prasyarat: seluruh migrasi sebelumnya.
-- Idempotent: aman dijalankan ulang.

-- ============ 1. ENUM ROLE ============
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'app_role'
  ) then
    create type public.app_role as enum ('client', 'mechanic', 'admin');
  end if;
end $$;

-- ============ 2. KONVERSI profiles.role (text -> app_role) ============
-- Policy yang membandingkan role langsung dengan fungsi text harus dilepas
-- sebelum tipe kolom diubah, lalu dibuat ulang dengan cast eksplisit.
drop policy if exists profiles_update_own on public.profiles;

do $$
declare
  v_data_type text;
  v_recreate_trigger boolean := false;
  r record;
begin
  select c.data_type
    into v_data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'role';

  if v_data_type = 'text' then
    -- PostgreSQL menolak ALTER TYPE bila kolom dipakai definisi trigger
    -- (`after ... update of role`). Lepas dulu, buat ulang setelah konversi.
    if exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and tgname = 'trg_ensure_mechanic_profile'
        and not tgisinternal
    ) then
      execute 'drop trigger trg_ensure_mechanic_profile on public.profiles';
      v_recreate_trigger := true;
    end if;

    -- Lepas CHECK constraint lama yang menyebut kolom role.
    for r in
      select conname
      from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%role%'
    loop
      execute format('alter table public.profiles drop constraint %I', r.conname);
    end loop;

    alter table public.profiles alter column role drop default;
    alter table public.profiles
      alter column role type public.app_role
      using role::public.app_role;
    alter table public.profiles
      alter column role set default 'client'::public.app_role;

    if v_recreate_trigger
       and to_regprocedure('public.ensure_mechanic_profile()') is not null then
      execute 'create trigger trg_ensure_mechanic_profile '
           || 'after insert or update of role on public.profiles '
           || 'for each row execute function public.ensure_mechanic_profile()';
    end if;
  end if;
end $$;

-- ============ 3. HELPER ROLE ============
-- has_role/current_role diperbarui agar aman terhadap tipe enum.
create or replace function public.has_role(required_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text = required_role
  );
$$;

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.role::text from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.has_role('admin');
$$;

grant execute on function public.has_role(text) to authenticated, service_role;
grant execute on function public.current_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- ============ 4. SIGNUP HANYA CLIENT / MECHANIC ============
-- Role dari metadata tetap divalidasi; 'admin' selalu jatuh ke 'client'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce((new.raw_user_meta_data ->> 'role'), 'client');
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
  return new;
end;
$$;

-- ============ 5. POLICY SELF-SERVICE PROFILES (dibuat ulang) ============
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (
    id = auth.uid()
    and (role::text = public.current_role() or public.has_role('admin'))
  );

-- ============ 6. CRUD ADMIN DI SELURUH TABEL ============
-- Satu policy FOR ALL per tabel. Policy OR-nya dengan policy lama, sehingga
-- akses montir/client tidak berubah.
do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'vehicles',
    'mechanic_profiles',
    'service_requests',
    'service_request_status_history',
    'ai_diagnoses',
    'locations',
    'mechanic_locations',
    'payments',
    'payment_events',
    'earnings',
    'activity_logs',
    'notifications',
    'reviews',
    'platform_settings',
    'mechanic_payout_accounts',
    'mechanic_wallets',
    'withdrawals',
    'withdrawal_events',
    'wallet_transactions',
    'service_request_assignment_rejections',
    'order_invoice_items'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    execute format('drop policy if exists admin_all on public.%I', t);
    execute format(
      'create policy admin_all on public.%I for all to authenticated '
      || 'using (public.has_role(''admin'')) '
      || 'with check (public.has_role(''admin''))',
      t
    );
  end loop;
end $$;

-- Tabel ini sebelumnya mencabut seluruh privilege dari authenticated.
grant select, insert, update, delete
  on public.service_request_assignment_rejections
  to authenticated;

-- ============ 7. STORAGE: ADMIN BOLEH KELOLA SEMUA FILE ============
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists storage_admin_all on storage.objects';
    execute 'create policy storage_admin_all on storage.objects '
         || 'for all to authenticated '
         || 'using (public.has_role(''admin'')) '
         || 'with check (public.has_role(''admin''))';
  end if;
end $$;

-- ============ 8. VIEW INFORMASI LENGKAP UNTUK ADMIN ============
-- security_invoker = true agar RLS tabel dasar tetap berlaku.
-- Filter has_role('admin') membuat non-admin melihat 0 baris.
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
  mp.identity_number,
  mp.current_lat,
  mp.current_lng,
  mp.last_location_at,
  (select count(*) from public.vehicles v where v.owner_id = p.id) as vehicle_count,
  (select count(*) from public.service_requests sr where sr.client_id = p.id) as client_request_count,
  (select count(*) from public.service_requests sr where sr.mechanic_id = p.id) as mechanic_request_count,
  (
    select coalesce(sum(pay.amount), 0)
    from public.payments pay
    join public.service_requests sr on sr.id = pay.request_id
    where sr.client_id = p.id and pay.status = 'paid'
  ) as total_spent,
  (
    select coalesce(sum(e.net_amount), 0)
    from public.earnings e
    where e.mechanic_id = p.id
  ) as total_earned
from public.profiles p
left join public.mechanic_profiles mp on mp.profile_id = p.id
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
  (
    select count(*)
    from public.order_invoice_items oii
    where oii.request_id = sr.id
  ) as invoice_item_count,
  (
    select coalesce(sum(oii.harga), 0)
    from public.order_invoice_items oii
    where oii.request_id = sr.id
  ) as invoice_total
from public.service_requests sr
left join public.profiles c on c.id = sr.client_id
left join public.profiles m on m.id = sr.mechanic_id
left join public.vehicles v on v.id = sr.vehicle_id
left join public.payments pay on pay.request_id = sr.id
where public.has_role('admin');

revoke all on public.admin_user_directory from public, anon;
revoke all on public.admin_transaction_overview from public, anon;
grant select on public.admin_user_directory to authenticated;
grant select on public.admin_transaction_overview to authenticated;

comment on view public.admin_user_directory is
  'Data lengkap client & montir untuk admin (profil, bengkel, kendaraan, transaksi).';
comment on view public.admin_transaction_overview is
  'Data lengkap transaksi untuk admin (order, client, montir, kendaraan, pembayaran, invoice).';

-- ============ 9. RPC PROVISIONING ROLE ============
-- Hanya admin (authenticated) atau service_role yang boleh mengubah role.
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_profile public.profiles;
  v_actor_role text := coalesce(auth.role(), '');
begin
  if v_actor_role <> 'service_role' and not public.has_role('admin') then
    raise exception 'AKSES_DITOLAK: hanya admin yang boleh mengubah role'
      using errcode = '42501';
  end if;

  if p_role not in ('client', 'mechanic', 'admin') then
    raise exception 'ROLE_TIDAK_VALID: %', p_role using errcode = '22023';
  end if;

  v_role := p_role::public.app_role;

  update public.profiles
     set role = v_role
   where id = p_user_id
   returning * into v_profile;

  if not found then
    raise exception 'PROFIL_TIDAK_DITEMUKAN' using errcode = 'P0002';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated, service_role;

comment on function public.set_user_role(uuid, text) is
  'Ubah role user (client/mechanic/admin). Hanya admin atau service_role.';
