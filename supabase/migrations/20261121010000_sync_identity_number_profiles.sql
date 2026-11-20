-- MontirGo — Sinkronisasi Nomor Identitas (NIK) antara profiles dan profile_identities (Dual-Sync).
--
-- Memastikan kolom `identity_number` di tabel `public.profiles` terisi dan selalu
-- sinkron dengan tabel `public.profile_identities`, sehingga developer/admin yang
-- melihat tabel `profiles` di Supabase Table Editor langsung melihat nilainya (tidak NULL).
--
-- Idempotent: aman dijalankan ulang (IF NOT EXISTS / OR REPLACE / DROP TRIGGER IF EXISTS).

-- ============ 1. PASTIKAN KOLOM & CONSTRAINT DI PROFILES ============
alter table public.profiles
  add column if not exists identity_number text;

alter table public.profiles
  drop constraint if exists profiles_identity_number_check;

alter table public.profiles
  add constraint profiles_identity_number_check
  check (identity_number is null or identity_number ~ '^[0-9]{16}$');

comment on column public.profiles.identity_number is
  'Nomor identitas (KTP/NIK) 16 digit. Bersifat permanen setelah tersimpan dan tersinkronisasi.';

-- ============ 2. SINKRONISASI DATA EKSIS ============
-- A. Salin dari profile_identities ke profiles
update public.profiles p
set identity_number = pi.identity_number
from public.profile_identities pi
where p.id = pi.profile_id
  and pi.identity_number ~ '^[0-9]{16}$'
  and (p.identity_number is null or p.identity_number is distinct from pi.identity_number);

-- B. Salin dari auth.users metadata jika profiles masih null
update public.profiles p
set identity_number = nullif(regexp_replace(coalesce(u.raw_user_meta_data ->> 'identity_number', ''), '[^0-9]', '', 'g'), '')
from auth.users u
where p.id = u.id
  and p.identity_number is null
  and nullif(regexp_replace(coalesce(u.raw_user_meta_data ->> 'identity_number', ''), '[^0-9]', '', 'g'), '') ~ '^[0-9]{16}$';

-- C. Salin balik ke profile_identities bila belum ada
insert into public.profile_identities (profile_id, identity_number)
select p.id, p.identity_number
from public.profiles p
where p.identity_number ~ '^[0-9]{16}$'
on conflict (profile_id) do update
  set identity_number = excluded.identity_number;

-- ============ 3. UPDATE TRIGGER handle_new_user ============
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

  insert into public.profiles (id, email, full_name, phone_number, role, identity_number)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'phone',
    v_role::public.app_role,
    case when v_identity_number ~ '^[0-9]{16}$' then v_identity_number else null end
  )
  on conflict (id) do update
    set identity_number = coalesce(public.profiles.identity_number, excluded.identity_number);

  if v_identity_number is not null and v_identity_number ~ '^[0-9]{16}$' then
    insert into public.profile_identities (profile_id, identity_number)
    values (new.id, v_identity_number)
    on conflict (profile_id) do update
      set identity_number = excluded.identity_number;
  end if;

  return new;
end;
$$;

-- ============ 4. TRIGGER DUAL-SYNC OTOMATIS ============
-- Sinkronisasi dari profile_identities -> profiles
create or replace function public.sync_identity_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set identity_number = new.identity_number
  where id = new.profile_id
    and (identity_number is null or identity_number is distinct from new.identity_number);
  return new;
end;
$$;

drop trigger if exists trg_sync_identity_to_profile on public.profile_identities;
create trigger trg_sync_identity_to_profile
  after insert or update of identity_number on public.profile_identities
  for each row execute function public.sync_identity_to_profile();

-- Sinkronisasi dari profiles -> profile_identities
create or replace function public.sync_profile_to_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.identity_number is not null and new.identity_number ~ '^[0-9]{16}$' then
    insert into public.profile_identities (profile_id, identity_number)
    values (new.id, new.identity_number)
    on conflict (profile_id) do update
      set identity_number = excluded.identity_number
      where public.profile_identities.identity_number is distinct from excluded.identity_number;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_to_identity on public.profiles;
create trigger trg_sync_profile_to_identity
  after insert or update of identity_number on public.profiles
  for each row execute function public.sync_profile_to_identity();

-- ============ 5. PERMANEN: CEGAH MODIFIKASI IDENTITY NUMBER OLEH USER BIASA ============
create or replace function public.prevent_profile_identity_number_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.identity_number is not null
     and new.identity_number is distinct from old.identity_number
     and auth.uid() is not null
     and not public.has_role('admin') then
    raise exception 'Nomor identitas (KTP) bersifat permanen dan tidak dapat diubah.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_identity_change on public.profiles;
create trigger trg_prevent_profile_identity_change
  before update of identity_number on public.profiles
  for each row execute function public.prevent_profile_identity_number_change();
