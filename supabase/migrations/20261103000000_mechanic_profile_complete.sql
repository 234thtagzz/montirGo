-- MontirGo — Profil montir lengkap (data bengkel, layanan, jadwal, sertifikasi,
-- rating/ulasan) beserta agregasi otomatis ke tabel `mechanic_profiles`.
--
-- Prasyarat: semua migrasi sebelumnya sudah dijalankan.
-- Idempotent: aman dijalankan ulang (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).

-- ============ 1. KOLOM PROFIL MONTIR LENGKAP ============
alter table public.mechanic_profiles
  add column if not exists bio text,
  add column if not exists experience_years int
    check (experience_years is null or (experience_years >= 0 and experience_years <= 80)),
  add column if not exists workshop_address text,
  add column if not exists workshop_phone text,
  add column if not exists workshop_lat double precision
    check (workshop_lat is null or (workshop_lat >= -90 and workshop_lat <= 90)),
  add column if not exists workshop_lng double precision
    check (workshop_lng is null or (workshop_lng >= -180 and workshop_lng <= 180)),
  add column if not exists service_radius_km numeric(5, 1) not null default 10
    check (service_radius_km >= 0 and service_radius_km <= 200),
  add column if not exists base_price integer not null default 0
    check (base_price >= 0),
  add column if not exists banner_url text,
  add column if not exists languages text[] not null default '{}',
  add column if not exists payment_methods text[] not null default '{cash,qris}',
  add column if not exists rating_count int not null default 0
    check (rating_count >= 0),
  add column if not exists response_time_minutes int
    check (response_time_minutes is null or response_time_minutes >= 0),
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles (id) on delete set null;

comment on column public.mechanic_profiles.bio is 'Deskripsi singkat montir/bengkel.';
comment on column public.mechanic_profiles.workshop_address is 'Alamat lengkap bengkel.';
comment on column public.mechanic_profiles.service_radius_km is 'Jarak maksimum montir bersedia datang (km).';
comment on column public.mechanic_profiles.base_price is 'Tarif dasar kunjungan (Rp).';
comment on column public.mechanic_profiles.rating_count is 'Jumlah ulasan yang dihitung, diisi trigger dari tabel reviews.';
comment on column public.mechanic_profiles.total_jobs is 'Jumlah order berstatus paid, diisi trigger dari service_requests.';

-- ============ 2. TABEL PENDUKUNG PROFIL ============

-- Daftar layanan + tarif yang ditawarkan montir.
create table if not exists public.mechanic_services (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  price integer not null default 0 check (price >= 0),
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mechanic_services_mechanic_idx
  on public.mechanic_services (mechanic_id, sort_order, created_at);

-- Sertifikasi / pelatihan montir.
create table if not exists public.mechanic_certifications (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  issuer text,
  issued_year int check (issued_year is null or (issued_year >= 1950 and issued_year <= 2100)),
  certificate_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mechanic_certifications_mechanic_idx
  on public.mechanic_certifications (mechanic_id, issued_year desc);

-- Jadwal operasional mingguan (0 = Minggu ... 6 = Sabtu).
create table if not exists public.mechanic_schedules (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mechanic_id, day_of_week)
);
create index if not exists mechanic_schedules_mechanic_idx
  on public.mechanic_schedules (mechanic_id, day_of_week);

-- Kolom tambahan pada ulasan: balasan montir & moderasi.
alter table public.reviews
  add column if not exists mechanic_reply text,
  add column if not exists replied_at timestamptz,
  add column if not exists is_visible boolean not null default true;

comment on column public.reviews.mechanic_reply is 'Balasan montir untuk ulasan client.';
comment on column public.reviews.is_visible is 'Ulasan tersembunyi tidak dihitung ke rating.';

-- ============ 3. TRIGGER updated_at ============
drop trigger if exists set_mechanic_services_updated_at on public.mechanic_services;
create trigger set_mechanic_services_updated_at
  before update on public.mechanic_services
  for each row execute function public.handle_updated_at();

drop trigger if exists set_mechanic_certifications_updated_at on public.mechanic_certifications;
create trigger set_mechanic_certifications_updated_at
  before update on public.mechanic_certifications
  for each row execute function public.handle_updated_at();

drop trigger if exists set_mechanic_schedules_updated_at on public.mechanic_schedules;
create trigger set_mechanic_schedules_updated_at
  before update on public.mechanic_schedules
  for each row execute function public.handle_updated_at();

-- ============ 4. OTOMATISASI DATA PROFIL ============

-- Pastikan setiap user role=mechanic punya baris mechanic_profiles.
-- Trigger ini melengkapi handle_new_user() dan juga menangani perubahan role.
create or replace function public.ensure_mechanic_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'mechanic' then
    insert into public.mechanic_profiles (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_mechanic_profile on public.profiles;
create trigger trg_ensure_mechanic_profile
  after insert or update of role on public.profiles
  for each row execute function public.ensure_mechanic_profile();

-- Backfill montir lama yang belum punya baris profil.
insert into public.mechanic_profiles (profile_id)
select p.id from public.profiles p where p.role = 'mechanic'
on conflict (profile_id) do nothing;

-- Hitung ulang rating_avg + rating_count dari tabel reviews.
create or replace function public.refresh_mechanic_rating(p_mechanic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_mechanic_id is null then
    return;
  end if;

  update public.mechanic_profiles mp
  set rating_avg = coalesce(
        (
          select round(avg(r.rating)::numeric, 1)
          from public.reviews r
          where r.mechanic_id = p_mechanic_id
            and r.is_visible = true
        ),
        0
      ),
      rating_count = (
        select count(*)
        from public.reviews r
        where r.mechanic_id = p_mechanic_id
          and r.is_visible = true
      )
  where mp.profile_id = p_mechanic_id;
end;
$$;

create or replace function public.trg_refresh_mechanic_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_mechanic_rating(old.mechanic_id);
    return old;
  end if;

  perform public.refresh_mechanic_rating(new.mechanic_id);
  if tg_op = 'UPDATE' and old.mechanic_id is distinct from new.mechanic_id then
    perform public.refresh_mechanic_rating(old.mechanic_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_refresh_rating on public.reviews;
create trigger trg_reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.trg_refresh_mechanic_rating();

-- Hitung ulang total_jobs dari order yang sudah lunas.
create or replace function public.refresh_mechanic_jobs(p_mechanic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_mechanic_id is null then
    return;
  end if;

  update public.mechanic_profiles mp
  set total_jobs = (
    select count(*)
    from public.service_requests sr
    where sr.mechanic_id = p_mechanic_id
      and sr.status = 'paid'
  )
  where mp.profile_id = p_mechanic_id;
end;
$$;

create or replace function public.trg_refresh_mechanic_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_mechanic_jobs(old.mechanic_id);
    return old;
  end if;

  perform public.refresh_mechanic_jobs(new.mechanic_id);
  if tg_op = 'UPDATE' and old.mechanic_id is distinct from new.mechanic_id then
    perform public.refresh_mechanic_jobs(old.mechanic_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_service_requests_refresh_jobs on public.service_requests;
create trigger trg_service_requests_refresh_jobs
  after insert or delete or update of mechanic_id, status on public.service_requests
  for each row execute function public.trg_refresh_mechanic_jobs();

-- Backfill rating & jumlah job dari data yang sudah ada.
update public.mechanic_profiles mp
set rating_avg = sub.rating_avg,
    rating_count = sub.rating_count
from (
  select mechanic_id,
         round(avg(rating)::numeric, 1) as rating_avg,
         count(*)::int as rating_count
  from public.reviews
  where is_visible = true
  group by mechanic_id
) sub
where mp.profile_id = sub.mechanic_id;

update public.mechanic_profiles mp
set total_jobs = sub.total_jobs
from (
  select mechanic_id, count(*)::int as total_jobs
  from public.service_requests
  where status = 'paid'
  group by mechanic_id
) sub
where mp.profile_id = sub.mechanic_id;

-- ============ 5. RPC BALASAN ULASAN ============
create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_review public.reviews;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;

  update public.reviews
  set mechanic_reply = nullif(trim(p_reply), ''),
      replied_at = now()
  where id = p_review_id
    and mechanic_id = v_uid
  returning * into v_review;

  if not found then
    raise exception 'REVIEW_NOT_FOUND';
  end if;

  return v_review;
end;
$$;

grant execute on function public.reply_to_review(uuid, text) to authenticated, service_role;

-- ============ 6. ROW LEVEL SECURITY TABEL BARU ============
alter table public.mechanic_services enable row level security;
alter table public.mechanic_certifications enable row level security;
alter table public.mechanic_schedules enable row level security;

-- Layanan: terlihat oleh pemilik/admin dan semua user login saat montir online.
drop policy if exists ms_select_visible on public.mechanic_services;
create policy ms_select_visible on public.mechanic_services
  for select to authenticated using (
    mechanic_id = auth.uid()
    or public.has_role('admin')
    or exists (
      select 1 from public.mechanic_profiles mp
      where mp.profile_id = mechanic_services.mechanic_id
        and mp.is_online = true
    )
  );

drop policy if exists ms_owner_insert on public.mechanic_services;
create policy ms_owner_insert on public.mechanic_services
  for insert to authenticated with check (mechanic_id = auth.uid());

drop policy if exists ms_owner_update on public.mechanic_services;
create policy ms_owner_update on public.mechanic_services
  for update to authenticated
  using (mechanic_id = auth.uid())
  with check (mechanic_id = auth.uid());

drop policy if exists ms_owner_delete on public.mechanic_services;
create policy ms_owner_delete on public.mechanic_services
  for delete to authenticated using (mechanic_id = auth.uid());

-- Sertifikasi: sertifikat terverifikasi boleh dibaca semua user login.
drop policy if exists mc_select_visible on public.mechanic_certifications;
create policy mc_select_visible on public.mechanic_certifications
  for select to authenticated using (
    mechanic_id = auth.uid()
    or is_verified = true
    or public.has_role('admin')
  );

drop policy if exists mc_owner_insert on public.mechanic_certifications;
create policy mc_owner_insert on public.mechanic_certifications
  for insert to authenticated with check (mechanic_id = auth.uid());

drop policy if exists mc_owner_update on public.mechanic_certifications;
create policy mc_owner_update on public.mechanic_certifications
  for update to authenticated
  using (mechanic_id = auth.uid())
  with check (mechanic_id = auth.uid());

drop policy if exists mc_owner_delete on public.mechanic_certifications;
create policy mc_owner_delete on public.mechanic_certifications
  for delete to authenticated using (mechanic_id = auth.uid());

-- Jadwal: terlihat saat montir online, pemilik selalu bisa membaca.
drop policy if exists msch_select_visible on public.mechanic_schedules;
create policy msch_select_visible on public.mechanic_schedules
  for select to authenticated using (
    mechanic_id = auth.uid()
    or public.has_role('admin')
    or exists (
      select 1 from public.mechanic_profiles mp
      where mp.profile_id = mechanic_schedules.mechanic_id
        and mp.is_online = true
    )
  );

drop policy if exists msch_owner_insert on public.mechanic_schedules;
create policy msch_owner_insert on public.mechanic_schedules
  for insert to authenticated with check (mechanic_id = auth.uid());

drop policy if exists msch_owner_update on public.mechanic_schedules;
create policy msch_owner_update on public.mechanic_schedules
  for update to authenticated
  using (mechanic_id = auth.uid())
  with check (mechanic_id = auth.uid());

drop policy if exists msch_owner_delete on public.mechanic_schedules;
create policy msch_owner_delete on public.mechanic_schedules
  for delete to authenticated using (mechanic_id = auth.uid());

-- Ulasan: client hanya boleh mengulas order miliknya yang sudah lunas.
drop policy if exists rev_insert_client on public.reviews;
create policy rev_insert_client on public.reviews
  for insert to authenticated with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.client_id = auth.uid()
        and sr.mechanic_id = reviews.mechanic_id
        and sr.status = 'paid'
    )
  );

-- ============ 7. VIEW PUBLIK (DATA AMAN UNTUK CLIENT) ============
-- Direktori montir online — diperluas dengan data bengkel, layanan, jadwal,
-- dan sertifikasi. Tetap tanpa email/telepon pribadi/koordinat.
drop view if exists public.mechanic_directory;

create view public.mechanic_directory
with (security_invoker = false)
as
select
  mp.profile_id,
  p.full_name,
  p.avatar_url,
  mp.workshop_name,
  mp.bio,
  mp.experience_years,
  mp.workshop_address,
  mp.service_radius_km,
  mp.base_price,
  mp.banner_url,
  mp.skills,
  mp.vehicle_specialization,
  mp.languages,
  mp.payment_methods,
  mp.rating_avg,
  mp.rating_count,
  mp.total_jobs,
  mp.response_time_minutes,
  mp.is_online,
  mp.is_available,
  mp.is_verified,
  mp.verified_at,
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'description', s.description,
          'price', s.price,
          'duration_minutes', s.duration_minutes
        )
        order by s.sort_order, s.created_at
      ),
      '[]'::jsonb
    )
    from public.mechanic_services s
    where s.mechanic_id = mp.profile_id
      and s.is_active = true
  ) as services,
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day_of_week', sc.day_of_week,
          'open_time', sc.open_time,
          'close_time', sc.close_time,
          'is_closed', sc.is_closed
        )
        order by sc.day_of_week
      ),
      '[]'::jsonb
    )
    from public.mechanic_schedules sc
    where sc.mechanic_id = mp.profile_id
  ) as schedules,
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'title', c.title,
          'issuer', c.issuer,
          'issued_year', c.issued_year,
          'is_verified', c.is_verified
        )
        order by c.issued_year desc nulls last
      ),
      '[]'::jsonb
    )
    from public.mechanic_certifications c
    where c.mechanic_id = mp.profile_id
      and c.is_verified = true
  ) as certifications
from public.mechanic_profiles mp
join public.profiles p on p.id = mp.profile_id
where mp.is_online = true;

comment on view public.mechanic_directory is
  'Direktori montir online untuk client: data bengkel, layanan, jadwal, sertifikasi, rating. Tanpa email/telepon pribadi/koordinat.';

revoke all on public.mechanic_directory from public;
revoke all on public.mechanic_directory from anon;
grant select on public.mechanic_directory to authenticated;

-- Ulasan publik: tanpa client_id, hanya nama depan + inisial.
drop view if exists public.mechanic_review_view;

create view public.mechanic_review_view
with (security_invoker = false)
as
select
  r.id,
  r.mechanic_id,
  r.rating,
  r.comment,
  r.mechanic_reply,
  r.replied_at,
  r.created_at,
  coalesce(
    nullif(
      split_part(coalesce(p.full_name, ''), ' ', 1)
      || case
           when position(' ' in coalesce(p.full_name, '')) > 0
             then ' ' || left(split_part(coalesce(p.full_name, ''), ' ', 2), 1) || '.'
           else ''
         end,
      ''
    ),
    'Client MontirGo'
  ) as reviewer_name
from public.reviews r
join public.profiles p on p.id = r.client_id
where r.is_visible = true;

comment on view public.mechanic_review_view is
  'Ulasan montir untuk ditampilkan ke publik. Tanpa client_id/telepon.';

revoke all on public.mechanic_review_view from public;
revoke all on public.mechanic_review_view from anon;
grant select on public.mechanic_review_view to authenticated;

-- ============ 8. GRANT TABEL BARU ============
grant select, insert, update, delete on public.mechanic_services to authenticated;
grant select, insert, update, delete on public.mechanic_certifications to authenticated;
grant select, insert, update, delete on public.mechanic_schedules to authenticated;
grant all on public.mechanic_services to service_role;
grant all on public.mechanic_certifications to service_role;
grant all on public.mechanic_schedules to service_role;

-- ============ 9. STORAGE ============
insert into storage.buckets (id, name, public)
values
  ('mechanic-banners', 'mechanic-banners', true)
on conflict (id) do nothing;

drop policy if exists storage_mechanic_banner_read on storage.objects;
create policy storage_mechanic_banner_read on storage.objects
  for select to authenticated using (bucket_id = 'mechanic-banners');

drop policy if exists storage_mechanic_banner_write_own on storage.objects;
create policy storage_mechanic_banner_write_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'mechanic-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_mechanic_banner_update_own on storage.objects;
create policy storage_mechanic_banner_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'mechanic-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'mechanic-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_mechanic_banner_delete_own on storage.objects;
create policy storage_mechanic_banner_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'mechanic-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
