-- MontirGo — Pastikan tabel profile_identities beserta objek pendukungnya ada.
--
-- Migrasi 20261120130000 tercatat terapply di remote namun tabel
-- `profile_identities` belum terbentuk (apply sebelumnya tidak lengkap).
-- File ini idempotent (IF NOT EXISTS / DROP IF EXISTS) sehingga aman dijalankan
-- meskipun sebagian objek sudah ada, dan tidak bergantung pada status migrasi
-- sebelumnya.
--
-- Urutan: diletakkan sebelum 20261120140000 (trigger permanen) agar tabel sudah
-- ada ketika trigger dibuat.

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

-- ============ 2. TRIGGER updated_at ============
drop trigger if exists set_profile_identities_updated_at on public.profile_identities;
create trigger set_profile_identities_updated_at
  before update on public.profile_identities
  for each row execute function public.handle_updated_at();

-- ============ 3. INDEX UNIK NOMOR IDENTITAS ============
create unique index if not exists profile_identities_identity_number_key
  on public.profile_identities (identity_number);

-- ============ 4. RLS & KEBIJAKAN AKSES ============
alter table public.profile_identities enable row level security;

drop policy if exists pi_select_own on public.profile_identities;
create policy pi_select_own on public.profile_identities
  for select to authenticated using (
    profile_id = auth.uid() or public.has_role('admin')
  );

drop policy if exists pi_insert_own on public.profile_identities;
create policy pi_insert_own on public.profile_identities
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists pi_admin_all on public.profile_identities;
create policy pi_admin_all on public.profile_identities
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- ============ 5. GRANT ============
grant select, insert, update, delete on public.profile_identities to authenticated;
grant all on public.profile_identities to service_role;
