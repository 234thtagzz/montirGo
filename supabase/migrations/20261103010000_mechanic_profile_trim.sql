-- MontirGo — Rampingkan profil montir ke data identitas saja.
--
-- Data yang dibutuhkan client untuk mengenali montir: nama, foto, bengkel,
-- pengalaman, keahlian, sertifikasi, status verifikasi, dan rating.
-- Kolom operasional/tarif (jadwal, tarif dasar, radius, waktu respons,
-- metode pembayaran, bahasa, koordinat bengkel, banner) dihapus karena bukan
-- bagian dari identitas montir.
--
-- Prasyarat: 20261103000000_mechanic_profile_complete.sql.
--
-- IDEMPOTENT & TAHAN URUTAN:
--   * Seluruh aksi "data" dibungkus blok `do $$ ... $$` yang memakai
--     `to_regclass()` / `information_schema`, sehingga setiap statement hanya
--     berjalan bila objek yang dirujuk memang ada.
--   * Aman dijalankan ulang, baik lewat `supabase db push` maupun langsung di
--     Supabase SQL Editor (termasuk bila migrasi sebelumnya sudah dijalankan
--     atau tabel `mechanic_certifications` sudah terhapus).
--   * Tabel/view yang barusan dibuat di script ini TIDAK dibaca di statement
--     berikutnya (PostgreSQL menyimpan rencana query sebelum DDL), jadi tidak
--     ada error "relation does not exist" saat eksekusi.

-- ============ 1. SERTIFIKASI JADI DATA IDENTITAS (TEXT[]) ============
alter table if exists public.mechanic_profiles
  add column if not exists certifications text[] not null default '{}';

comment on column public.mechanic_profiles.certifications is
  'Sertifikasi montir, satu baris per sertifikat: "Nama — Penerbit (2024)".';

-- ============ 2. MIGRASI & PEMBERSIHAN DATA ============
-- Semua pembacaan tabel lama dilakukan di dalam DO block agar rencana query
-- disusun saat blok dijalankan (bukan saat file di-parse).
do $$
begin
  if to_regclass('public.mechanic_profiles') is null then
    raise notice 'mechanic_profiles tidak ada — migrasi rampingkan profil dilewati.';
    return;
  end if;

  -- 2a. Pindahkan sertifikasi lama (tabel relasional) ke kolom text[]
  --     sebelum tabelnya dihapus. Hanya mengisi montir yang belum punya data.
  if to_regclass('public.mechanic_certifications') is not null then
    execute $mig$
      update public.mechanic_profiles mp
      set certifications = sub.items
      from (
        select mechanic_id,
               array_agg(
                 title
                 || case
                      when coalesce(issuer, '') <> '' or issued_year is not null then ' — '
                      else ''
                    end
                 || coalesce(nullif(issuer, ''), '')
                 || case
                      when issued_year is not null then
                        case when coalesce(nullif(issuer, ''), '') <> '' then ' ' else '' end
                        || '(' || issued_year || ')'
                      else ''
                    end
                 order by issued_year desc nulls last, created_at
               ) as items
        from public.mechanic_certifications
        where coalesce(title, '') <> ''
        group by mechanic_id
      ) sub
      where mp.profile_id = sub.mechanic_id
        and coalesce(array_length(mp.certifications, 1), 0) = 0
    $mig$;
  end if;

  -- 2b. Kolom baru dari migrasi 20261103000000 bisa saja belum ada bila
  --     skrip ini dijalankan pada database lama. Pastikan dulu agar DROP
  --     COLUMN dan view di bawah tidak gagal.
  --     `verified_by` sengaja tidak menambahkan FK: tujuannya hanya memastikan
  --     kolom pensiun itu memang tidak dipakai view/trigger baru.
  execute $mig$
    alter table public.mechanic_profiles
      add column if not exists bio text,
      add column if not exists experience_years int,
      add column if not exists workshop_address text,
      add column if not exists workshop_name text,
      add column if not exists rating_count int not null default 0,
      add column if not exists verified_at timestamptz
  $mig$;

  -- 2c. Hapus tabel profil operasional yang tidak dipakai lagi.
  --     `cascade` menjaga bila masih ada objek bergantung (rantai dependensi).
  execute 'drop table if exists public.mechanic_services cascade';
  execute 'drop table if exists public.mechanic_schedules cascade';
  execute 'drop table if exists public.mechanic_certifications cascade';

  -- 2d. Hapus kolom non-identitas.
  execute $mig$
    alter table public.mechanic_profiles
      drop column if exists workshop_lat,
      drop column if exists workshop_lng,
      drop column if exists workshop_phone,
      drop column if exists base_price,
      drop column if exists service_radius_km,
      drop column if exists response_time_minutes,
      drop column if exists payment_methods,
      drop column if exists languages,
      drop column if exists banner_url
  $mig$;
end
$$;

-- ============ 3. VIEW DIREKTORI MONTIR BARU ============
-- Hanya kolom identitas; tanpa email/telepon pribadi/koordinat.
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
  'Direktori montir online untuk client: identitas, bengkel, keahlian, sertifikasi, rating. Tanpa email/telepon pribadi.';

revoke all on public.mechanic_directory from public;
revoke all on public.mechanic_directory from anon;
grant select on public.mechanic_directory to authenticated;

-- Catatan: bucket `mechanic-banners` sengaja tidak dihapus dari sini karena
-- Supabase memblokir DELETE langsung ke `storage.buckets`/`storage.objects`.
-- Bucket itu tidak lagi dipakai aplikasi dan bisa dihapus dari Dashboard
-- (Storage > mechanic-banners).
