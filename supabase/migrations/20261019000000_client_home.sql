-- MontirGo — kebutuhan Beranda client (PRD §7, §15).
-- Prasyarat: 20261015000000_init_montirgo.sql sudah dijalankan.
-- Idempotent: aman dijalankan ulang.
--
-- MASALAH: policy `profiles_select_counterpart` hanya mengizinkan client membaca
-- profil montir jika sudah ada service_request yang menghubungkan keduanya.
-- Akibatnya daftar "montir terdekat" tidak bisa menampilkan nama montir online.
--
-- SOLUSI: view khusus berisi kolom aman saja (tanpa telepon, tanpa koordinat),
-- hanya untuk montir yang sedang online. View ini dimiliki role pemilik skema
-- sehingga tidak tunduk RLS tabel, namun kolom yang terekspos sudah dibatasi.

create or replace view public.mechanic_directory
with (security_invoker = false)
as
select
  mp.profile_id,
  p.full_name,
  p.avatar_url,
  mp.workshop_name,
  mp.rating_avg,
  mp.total_jobs,
  mp.is_online,
  mp.is_available
from public.mechanic_profiles mp
join public.profiles p on p.id = mp.profile_id
where mp.is_online = true;

comment on view public.mechanic_directory is
  'Direktori montir online untuk Beranda client. Kolom terbatas: tanpa telepon/email/koordinat.';

-- Hanya user login yang boleh membaca direktori.
revoke all on public.mechanic_directory from public;
revoke all on public.mechanic_directory from anon;
grant select on public.mechanic_directory to authenticated;
