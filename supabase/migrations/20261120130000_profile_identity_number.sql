-- MontirGo — Nomor identitas (KTP) untuk client & montir.
--
-- Nomor identitas (NIK/KTP) wajib diisi saat registrasi akun dan disimpan di
-- tabel terpisah `profile_identities` agar tidak ikut terbaca oleh lawan
-- transaksi lewat policy `profiles_select_counterpart`. Hanya pemilik akun
-- (dan admin) yang boleh membaca nomornya.
--
-- Prasyarat: 20261119000000_admin_role.sql (profiles.role bertipe app_role).
-- Idempotent: aman dijalankan ulang (IF NOT EXISTS / CREATE OR REPLACE).

-- ============ 1. TABEL NOMOR IDENTITAS ============
create table if not exists public.profile_identities (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  identity_number text not null
    check (identity_number ~ '^[0-9]{16}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_identities is
  'Nomor identitas (KTP/NIK) 16 digit milik client atau montir. Hanya dapat dibaca pemilik akun dan admin.';
comment on column public.profile_identities.identity_number is
  'Nomor identitas (KTP/NIK) 16 digit. Bersifat permanen setelah tersimpan.';

-- ============ 2. ISI OTOMATIS SAAT REGISTRASI ============
-- Nomor identitas dikirim aplikasi lewat user_metadata.identity_number saat
-- signUp, lalu disalin trigger ini ke profile_identities. Fungsi diganti
-- SEBELUM kolom lama dihapus agar tidak ada celah signup yang gagal.
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
    insert into public.profile_identities (profile_id, identity_number)
    values (new.id, v_identity_number)
    on conflict (profile_id) do nothing;
  end if;

  return new;
end;
$$;

-- ============ 3. MIGRASI DARI VERSI KOLOM LAMA ============
-- Bila versi sebelumnya (profiles.identity_number) sudah sempat diterapkan,
-- salin datanya lalu hapus kolomnya agar tidak bisa dibaca lawan transaksi.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'identity_number'
  ) then
    execute $mig$
      insert into public.profile_identities (profile_id, identity_number)
      select p.id, p.identity_number
      from public.profiles p
      where p.identity_number ~ '^[0-9]{16}$'
      on conflict (profile_id) do nothing
    $mig$;

    execute 'drop trigger if exists trg_prevent_identity_number_change on public.profiles';
    execute 'alter table public.profiles drop column identity_number';
  end if;
end $$;

-- Lengkapi dari kolom lama `mechanic_profiles.identity_number` (data awal
-- aplikasi) bila belum ada padanannya — tetap hanya nilai 16 digit yang sah.
insert into public.profile_identities (profile_id, identity_number)
select mp.profile_id, mp.identity_number
from public.mechanic_profiles mp
where mp.identity_number ~ '^[0-9]{16}$'
  and not exists (
    select 1
    from public.profile_identities pi
    where pi.profile_id = mp.profile_id
       or pi.identity_number = mp.identity_number
  )
on conflict (profile_id) do nothing;

create unique index if not exists profile_identities_identity_number_key
  on public.profile_identities (identity_number);

drop trigger if exists set_profile_identities_updated_at on public.profile_identities;
create trigger set_profile_identities_updated_at
  before update on public.profile_identities
  for each row execute function public.handle_updated_at();

-- ============ 4. AKSES: HANYA PEMILIK & ADMIN ============
alter table public.profile_identities enable row level security;

drop policy if exists pi_select_own on public.profile_identities;
create policy pi_select_own on public.profile_identities
  for select to authenticated using (
    profile_id = auth.uid() or public.has_role('admin')
  );

drop policy if exists pi_insert_own on public.profile_identities;
create policy pi_insert_own on public.profile_identities
  for insert to authenticated with check (profile_id = auth.uid());

-- Tidak ada policy update/delete untuk pengguna: nomor identitas permanen.
-- Admin tetap bisa mengoreksi data lewat policy admin_all.
drop policy if exists pi_admin_all on public.profile_identities;
create policy pi_admin_all on public.profile_identities
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

grant select, insert, update, delete on public.profile_identities to authenticated;
grant all on public.profile_identities to service_role;
