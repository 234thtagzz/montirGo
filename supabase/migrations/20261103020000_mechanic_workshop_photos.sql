-- MontirGo — Foto bengkel pada profil montir.
--
-- Client memakai foto bengkel untuk mengenali tempat kerja montir, jadi foto
-- disimpan sebagai bagian dari identitas (kolom `text[]`), bukan tabel terpisah.
--
-- Nilai yang disimpan adalah PATH objek di bucket privat `workshop-photos`
-- (bukan URL publik), konsisten dengan `vehicles.photo_url`. Aplikasi membuat
-- signed URL saat menampilkan.
--
-- Prasyarat: 20261103010000_mechanic_profile_trim.sql.
-- Idempotent: aman dijalankan ulang.

-- ============ 1. KOLOM FOTO BENGKEL ============
alter table public.mechanic_profiles
  add column if not exists workshop_photos text[] not null default '{}';

comment on column public.mechanic_profiles.workshop_photos is
  'Path foto bengkel di bucket privat workshop-photos. Maksimal 5 foto, urutan = urutan tampil.';

-- ============ 2. VIEW DIREKTORI: HANYA 1 FOTO UTAMA ============
-- Client hanya butuh sampul bengkel; foto lain milik montir sendiri.
drop view if exists public.mechanic_directory;

create view public.mechanic_directory
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
  mp.is_online,
  mp.is_available,
  mp.is_verified,
  mp.verified_at
from public.mechanic_profiles mp
join public.profiles p on p.id = mp.profile_id
where mp.is_online = true;

comment on view public.mechanic_directory is
  'Direktori montir online untuk client: identitas, bengkel, foto utama bengkel, keahlian, sertifikasi, rating. Tanpa email/telepon pribadi.';

revoke all on public.mechanic_directory from public;
revoke all on public.mechanic_directory from anon;
grant select on public.mechanic_directory to authenticated;

-- ============ 3. STORAGE BUCKET PRIVAT ============
insert into storage.buckets (id, name, public)
values ('workshop-photos', 'workshop-photos', false)
on conflict (id) do nothing;

-- Baca: pemilik foto, admin, atau client yang sudah punya order dengan montir
-- tersebut (sama seperti policy `vehicles_mechanic_read` pada tabel vehicles).
drop policy if exists storage_workshop_photo_read on storage.objects;
create policy storage_workshop_photo_read on storage.objects
  for select to authenticated using (
    bucket_id = 'workshop-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role('admin')
      or exists (
        select 1 from public.service_requests sr
        where sr.mechanic_id = ((storage.foldername(name))[1])::uuid
          and sr.client_id = auth.uid()
      )
    )
  );

drop policy if exists storage_workshop_photo_write_own on storage.objects;
create policy storage_workshop_photo_write_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'workshop-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_workshop_photo_delete_own on storage.objects;
create policy storage_workshop_photo_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'workshop-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
