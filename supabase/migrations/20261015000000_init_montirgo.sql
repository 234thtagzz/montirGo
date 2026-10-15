-- MontirGo initial schema — MVP (PRD §21 DATABASE)
-- Cara pakai:
--   1. Supabase Dashboard > SQL Editor > New query > paste seluruh file ini > Run, ATAU
--   2. Supabase CLI: supabase link lalu supabase db push (file ini di supabase/migrations/)
-- Idempotent: aman dijalankan ulang (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).

-- ============ 0. EXTENSIONS ============
create extension if not exists "pgcrypto";

-- ============ 1. HELPERS (tanpa dependensi tabel) ============
-- updated_at otomatis
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ 2. TABLES ============

-- ---- profiles (1:1 dengan auth.users) ----
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'mechanic', 'admin')),
  full_name text,
  email text,
  phone_number text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---- vehicles (client bisa punya >1, PRD §20) ----
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('motor', 'mobil', 'lainnya')),
  brand text not null,
  model text not null,
  year int check (year >= 1980 and year <= 2100),
  license_plate text not null,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vehicles_owner_idx on public.vehicles (owner_id);

-- ---- mechanic_profiles (1:1 dengan profiles role=mechanic) ----
create table if not exists public.mechanic_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  workshop_name text,
  skills text[] not null default '{}',
  vehicle_specialization text[] not null default '{}',
  identity_number text,
  is_online boolean not null default false,
  is_available boolean not null default true,
  is_verified boolean not null default false,
  rating_avg numeric(2,1) not null default 0 check (rating_avg >= 0 and rating_avg <= 5),
  total_jobs int not null default 0 check (total_jobs >= 0),
  current_lat double precision,
  current_lng double precision,
  last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mechanic_profiles_online_idx
  on public.mechanic_profiles (is_online, is_available) where is_online = true;

-- ---- service_requests (PRD §9, §16) ----
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete restrict,
  mechanic_id uuid references public.profiles (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  issue_description text not null,
  symptoms text,
  photo_urls text[] not null default '{}',
  lat double precision not null check (lat >= -90 and lat <= 90),
  lng double precision not null check (lng >= -180 and lng <= 180),
  address text,
  contact_phone text not null,
  additional_notes text,
  status text not null default 'requested' check (status in (
    'requested', 'matching', 'mechanic_assigned', 'mechanic_accepted',
    'on_the_way', 'arrived', 'diagnosing', 'repairing',
    'completed', 'payment', 'paid', 'cancelled'
  )),
  price_amount integer check (price_amount is null or price_amount >= 0),
  currency text not null default 'IDR',
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz
);
create index if not exists sr_client_idx on public.service_requests (client_id, created_at desc);
create index if not exists sr_mechanic_idx on public.service_requests (mechanic_id, created_at desc);
create index if not exists sr_status_idx on public.service_requests (status);
create index if not exists sr_vehicle_idx on public.service_requests (vehicle_id);

-- ---- service_request_status_history (semua perubahan status tercatat, PRD §16) ----
create table if not exists public.service_request_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists srsh_request_idx
  on public.service_request_status_history (request_id, created_at desc);

-- ---- ai_diagnoses (PRD §10: preliminary analysis, BUKAN diagnosis final) ----
create table if not exists public.ai_diagnoses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  possible_issues jsonb not null default '[]',
  symptoms_summary text,
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  recommended_checks text[] not null default '{}',
  suggested_tools text[] not null default '{}',
  estimated_complexity text check (estimated_complexity is null or estimated_complexity in ('ringan', 'sedang', 'berat')),
  questions_for_client text[] not null default '{}',
  raw_response jsonb,
  disclaimer text not null default 'Hasil AI adalah indikasi awal dan memerlukan pemeriksaan langsung oleh montir.',
  created_at timestamptz not null default now()
);
create index if not exists ai_request_idx on public.ai_diagnoses (request_id);

-- ---- locations (snapshot lokasi terkait request/user) ----
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  lat double precision not null check (lat >= -90 and lat <= 90),
  lng double precision not null check (lng >= -180 and lng <= 180),
  address text,
  recorded_at timestamptz not null default now()
);
create index if not exists locations_request_idx on public.locations (request_id);

-- ---- mechanic_locations (tracking hanya saat order aktif, PRD §12) ----
create table if not exists public.mechanic_locations (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid references public.service_requests (id) on delete set null,
  lat double precision not null check (lat >= -90 and lat <= 90),
  lng double precision not null check (lng >= -180 and lng <= 180),
  accuracy_meters double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists ml_mechanic_time_idx
  on public.mechanic_locations (mechanic_id, recorded_at desc);
create index if not exists ml_request_idx on public.mechanic_locations (request_id);

-- ---- payments (PRD §17, verifikasi via backend/webhook) ----
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests (id) on delete restrict,
  amount integer not null check (amount >= 0),
  platform_fee integer not null default 0 check (platform_fee >= 0),
  net_amount integer not null check (net_amount >= 0),
  currency text not null default 'IDR',
  method text not null default 'qris'
    check (method in ('qris', 'gopay', 'dana', 'transfer', 'cash', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded')),
  gateway_reference text,
  qr_payload text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_status_idx on public.payments (status);

-- ---- payment_events (audit webhook, PRD §17) ----
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pe_payment_idx on public.payment_events (payment_id, created_at desc);

-- ---- earnings (dihitung backend, PRD §18) ----
create table if not exists public.earnings (
  id uuid primary key default gen_random_uuid(),
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null unique references public.service_requests (id) on delete restrict,
  gross_amount integer not null check (gross_amount >= 0),
  platform_fee integer not null default 0 check (platform_fee >= 0),
  net_amount integer not null check (net_amount >= 0),
  period_date date not null default (now()::date),
  created_at timestamptz not null default now()
);
create index if not exists earnings_mechanic_date_idx
  on public.earnings (mechanic_id, period_date desc);

-- ---- activity_logs (PRD §19) ----
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  activity_type text not null,
  description text,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists al_user_time_idx on public.activity_logs (user_id, created_at desc);

-- ---- notifications (Phase 2: push; MVP: in-app) ----
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'general',
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_user_idx
  on public.notifications (user_id, created_at desc) where is_read = false;

-- ---- reviews (Phase 2, skema disiapkan dari awal) ----
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_mechanic_idx on public.reviews (mechanic_id);

-- ============ 2b. HELPERS (butuh tabel profiles, DEFINISI SETELAH TABLES) ============
-- Cek role dari database tanpa rekursi RLS (SECURITY DEFINER bypass RLS).
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
      and p.role = required_role
  );
$$;

-- Role user saat ini (SECURITY DEFINER agar tidak rekursi RLS).
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- Auto-create profiles saat user daftar via Supabase Auth.
-- Role diambil dari user_metadata.role, divalidasi whitelist, default 'client'.
-- JANGAN percaya role dari client tanpa validasi: hanya 'client'/'mechanic' boleh via signup.
-- 'admin' hanya bisa di-set manual oleh admin/service_role.
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
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

grant execute on function public.has_role(text) to authenticated, service_role;
grant execute on function public.current_role() to authenticated, service_role;

-- ============ 3. TRIGGERS ============
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_vehicles_updated_at on public.vehicles;
create trigger set_vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_mechanic_profiles_updated_at on public.mechanic_profiles;
create trigger set_mechanic_profiles_updated_at
  before update on public.mechanic_profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_service_requests_updated_at on public.service_requests;
create trigger set_service_requests_updated_at
  before update on public.service_requests
  for each row execute function public.handle_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
  before update on public.payments
  for each row execute function public.handle_updated_at();

-- ============ 4. ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.mechanic_profiles enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_status_history enable row level security;
alter table public.ai_diagnoses enable row level security;
alter table public.locations enable row level security;
alter table public.mechanic_locations enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.earnings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.reviews enable row level security;

-- ---- profiles ----
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_select_counterpart on public.profiles;
create policy profiles_select_counterpart on public.profiles
  for select to authenticated using (
    exists (
      select 1 from public.service_requests sr
      where (sr.client_id = auth.uid() and sr.mechanic_id = profiles.id)
         or (sr.mechanic_id = auth.uid() and sr.client_id = profiles.id)
    )
    or public.has_role('admin')
  );

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid())
  -- Role tidak boleh di-eskalasi dari client; hanya admin yang boleh ubah role.
  with check (
    id = auth.uid()
    and (role = public.current_role() or public.has_role('admin'))
  );

-- ---- vehicles ----
drop policy if exists vehicles_owner_all on public.vehicles;
create policy vehicles_owner_all on public.vehicles
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists vehicles_mechanic_read on public.vehicles;
create policy vehicles_mechanic_read on public.vehicles
  for select to authenticated using (
    exists (
      select 1 from public.service_requests sr
      where sr.vehicle_id = vehicles.id
        and sr.mechanic_id = auth.uid()
    )
    or public.has_role('admin')
  );

-- ---- mechanic_profiles ----
-- Semua user login bisa melihat montir yang online/terverifikasi (untuk matching, PRD §15).
drop policy if exists mp_select_visible on public.mechanic_profiles;
create policy mp_select_visible on public.mechanic_profiles
  for select to authenticated using (
    profile_id = auth.uid()
    or is_online = true
    or public.has_role('admin')
  );

drop policy if exists mp_insert_own on public.mechanic_profiles;
create policy mp_insert_own on public.mechanic_profiles
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists mp_update_own on public.mechanic_profiles;
create policy mp_update_own on public.mechanic_profiles
  for update to authenticated
  using (profile_id = auth.uid() or public.has_role('admin'))
  with check (profile_id = auth.uid() or public.has_role('admin'));

-- ---- service_requests ----
drop policy if exists sr_select_participant on public.service_requests;
create policy sr_select_participant on public.service_requests
  for select to authenticated using (
    client_id = auth.uid()
    or mechanic_id = auth.uid()
    or public.has_role('admin')
  );

drop policy if exists sr_select_open_for_mechanics on public.service_requests;
create policy sr_select_open_for_mechanics on public.service_requests
  for select to authenticated using (
    status in ('requested', 'matching') and public.has_role('mechanic')
  );

drop policy if exists sr_insert_client on public.service_requests;
create policy sr_insert_client on public.service_requests
  for insert to authenticated with check (client_id = auth.uid());

-- Update status/order sensitif HARUS lewat backend (service_role / Edge Function).
-- Policy client dibatasi: client hanya boleh cancel miliknya; assignment & harga via backend.
drop policy if exists sr_update_client_cancel on public.service_requests;
create policy sr_update_client_cancel on public.service_requests
  for update to authenticated
  using (client_id = auth.uid() and status in ('requested', 'matching'))
  with check (client_id = auth.uid() and status = 'cancelled');

drop policy if exists sr_service_role_all on public.service_requests;
create policy sr_service_role_all on public.service_requests
  for all to service_role using (true) with check (true);

-- ---- status history: baca oleh partisipan, tulis via backend ----
drop policy if exists srsh_select_participant on public.service_request_status_history;
create policy srsh_select_participant on public.service_request_status_history
  for select to authenticated using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and (sr.client_id = auth.uid() or sr.mechanic_id = auth.uid())
    )
    or public.has_role('admin')
  );

drop policy if exists srsh_service_role_all on public.service_request_status_history;
create policy srsh_service_role_all on public.service_request_status_history
  for all to service_role using (true) with check (true);

-- ---- ai_diagnoses: baca oleh partisipan, tulis via backend (Edge Function) ----
drop policy if exists ai_select_participant on public.ai_diagnoses;
create policy ai_select_participant on public.ai_diagnoses
  for select to authenticated using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and (sr.client_id = auth.uid() or sr.mechanic_id = auth.uid())
    )
    or public.has_role('admin')
  );

drop policy if exists ai_service_role_all on public.ai_diagnoses;
create policy ai_service_role_all on public.ai_diagnoses
  for all to service_role using (true) with check (true);

-- ---- locations ----
drop policy if exists loc_select_participant on public.locations;
create policy loc_select_participant on public.locations
  for select to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.service_requests sr
      where sr.id = locations.request_id
        and (sr.client_id = auth.uid() or sr.mechanic_id = auth.uid())
    )
    or public.has_role('admin')
  );

drop policy if exists loc_insert_own on public.locations;
create policy loc_insert_own on public.locations
  for insert to authenticated with check (user_id = auth.uid());

-- ---- mechanic_locations ----
drop policy if exists ml_select_involved on public.mechanic_locations;
create policy ml_select_involved on public.mechanic_locations
  for select to authenticated using (
    mechanic_id = auth.uid()
    or exists (
      select 1 from public.service_requests sr
      where sr.id = mechanic_locations.request_id
        and sr.client_id = auth.uid()
    )
    or public.has_role('admin')
  );

drop policy if exists ml_insert_own on public.mechanic_locations;
create policy ml_insert_own on public.mechanic_locations
  for insert to authenticated with check (mechanic_id = auth.uid());

-- ---- payments & payment_events: tulis via backend, baca oleh partisipan ----
drop policy if exists pay_select_participant on public.payments;
create policy pay_select_participant on public.payments
  for select to authenticated using (
    exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and (sr.client_id = auth.uid() or sr.mechanic_id = auth.uid())
    )
    or public.has_role('admin')
  );

drop policy if exists pay_service_role_all on public.payments;
create policy pay_service_role_all on public.payments
  for all to service_role using (true) with check (true);

drop policy if exists pe_select_participant on public.payment_events;
create policy pe_select_participant on public.payment_events
  for select to authenticated using (
    exists (
      select 1 from public.payments p
      join public.service_requests sr on sr.id = p.request_id
      where p.id = payment_id
        and (sr.client_id = auth.uid() or sr.mechanic_id = auth.uid())
    )
    or public.has_role('admin')
  );

drop policy if exists pe_service_role_all on public.payment_events;
create policy pe_service_role_all on public.payment_events
  for all to service_role using (true) with check (true);

-- ---- earnings: montir hanya baca miliknya, tulis via backend ----
drop policy if exists earn_select_own on public.earnings;
create policy earn_select_own on public.earnings
  for select to authenticated using (
    mechanic_id = auth.uid() or public.has_role('admin')
  );

drop policy if exists earn_service_role_all on public.earnings;
create policy earn_service_role_all on public.earnings
  for all to service_role using (true) with check (true);

-- ---- activity_logs ----
drop policy if exists al_select_own on public.activity_logs;
create policy al_select_own on public.activity_logs
  for select to authenticated using (
    user_id = auth.uid() or public.has_role('admin')
  );

drop policy if exists al_insert_own on public.activity_logs;
create policy al_insert_own on public.activity_logs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists al_service_role_all on public.activity_logs;
create policy al_service_role_all on public.activity_logs
  for all to service_role using (true) with check (true);

-- ---- notifications ----
drop policy if exists notif_owner_all on public.notifications;
create policy notif_owner_all on public.notifications
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notif_service_role_all on public.notifications;
create policy notif_service_role_all on public.notifications
  for all to service_role using (true) with check (true);

-- ---- reviews ----
drop policy if exists rev_select_involved on public.reviews;
create policy rev_select_involved on public.reviews
  for select to authenticated using (
    client_id = auth.uid() or mechanic_id = auth.uid() or public.has_role('admin')
  );

drop policy if exists rev_insert_client on public.reviews;
create policy rev_insert_client on public.reviews
  for insert to authenticated with check (client_id = auth.uid());

-- ============ 5. STORAGE BUCKETS ============
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('vehicle-photos', 'vehicle-photos', false),
  ('service-photos', 'service-photos', false)
on conflict (id) do nothing;

-- Kebijakan storage: avatar publik read; foto kendaraan/service hanya owner + montir terkait.
drop policy if exists storage_avatar_read on storage.objects;
create policy storage_avatar_read on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

drop policy if exists storage_avatar_write_own on storage.objects;
create policy storage_avatar_write_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_private_owner on storage.objects;
create policy storage_private_owner on storage.objects
  for select to authenticated using (
    bucket_id in ('vehicle-photos', 'service-photos')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role('admin')
    )
  );

drop policy if exists storage_private_write_own on storage.objects;
create policy storage_private_write_own on storage.objects
  for insert to authenticated with check (
    bucket_id in ('vehicle-photos', 'service-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
