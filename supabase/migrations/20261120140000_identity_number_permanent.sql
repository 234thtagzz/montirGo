-- MontirGo — Nomor identitas (KTP) bersifat permanen.
--
-- Pengguna tidak memiliki policy UPDATE/DELETE pada `profile_identities`, jadi
-- nomor identitas tidak bisa diubah lewat aplikasi/API. Trigger ini menjadi
-- lapisan kedua: perubahan hanya boleh dilakukan admin atau service role
-- (auth.uid() null) untuk koreksi data.
--
-- Prasyarat: 20261120130000_profile_identity_number.sql.
-- Idempotent: aman dijalankan ulang (CREATE OR REPLACE / DROP TRIGGER IF EXISTS).

create or replace function public.prevent_identity_number_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.identity_number is distinct from new.identity_number
     and auth.uid() is not null
     and not public.has_role('admin') then
    raise exception 'Nomor identitas (KTP) bersifat permanen dan tidak dapat diubah.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.prevent_identity_number_change() is
  'Menolak perubahan identity_number oleh pengguna setelah terisi (permanen).';

-- Bersihkan trigger lama (bila versi sebelumnya sempat diterapkan di profiles).
drop trigger if exists trg_prevent_identity_number_change on public.profiles;
drop trigger if exists trg_prevent_identity_number_change on public.profile_identities;
create trigger trg_prevent_identity_number_change
  before update on public.profile_identities
  for each row execute function public.prevent_identity_number_change();
