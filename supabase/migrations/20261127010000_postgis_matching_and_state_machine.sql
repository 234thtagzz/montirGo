-- MontirGo Phase 2: PostGIS Geospatial Matching, Privacy-Safe Discovery & Atomic Order State Machine.
-- Prasyarat: 20261127000000_p0_security_privacy_schema_hardening.sql.
-- Idempotent & aman dijalankan ulang.

-- ============ 1. POSTGIS & KOLOM GEOSPATIAL ============

create extension if not exists postgis with schema extensions;

alter table public.service_requests
  add column if not exists location extensions.geography(Point, 4326);

alter table public.mechanic_profiles
  add column if not exists location extensions.geography(Point, 4326),
  add column if not exists service_radius_km numeric(5, 1) not null default 15;

alter table public.mechanic_profiles
  drop constraint if exists mechanic_profiles_service_radius_km_check;
alter table public.mechanic_profiles
  add constraint mechanic_profiles_service_radius_km_check
  check (service_radius_km >= 1 and service_radius_km <= 100);

update public.service_requests
set location = extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
where location is null and lat is not null and lng is not null;

update public.mechanic_profiles
set location = extensions.ST_SetSRID(extensions.ST_MakePoint(current_lng, current_lat), 4326)::extensions.geography
where location is null and current_lat is not null and current_lng is not null;

create or replace function public.sync_sr_geography()
returns trigger
language plpgsql
as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := extensions.ST_SetSRID(extensions.ST_MakePoint(new.lng, new.lat), 4326)::extensions.geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

create or replace function public.sync_mp_geography()
returns trigger
language plpgsql
as $$
begin
  if new.current_lat is not null and new.current_lng is not null then
    new.location := extensions.ST_SetSRID(extensions.ST_MakePoint(new.current_lng, new.current_lat), 4326)::extensions.geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_sr_geography on public.service_requests;
create trigger trg_sync_sr_geography
  before insert or update of lat, lng on public.service_requests
  for each row execute function public.sync_sr_geography();

drop trigger if exists trg_sync_mp_geography on public.mechanic_profiles;
create trigger trg_sync_mp_geography
  before insert or update of current_lat, current_lng on public.mechanic_profiles
  for each row execute function public.sync_mp_geography();

create index if not exists sr_location_gist_idx on public.service_requests using gist (location);
create index if not exists mp_location_gist_idx on public.mechanic_profiles using gist (location);

insert into public.platform_settings (key, value) values
  ('default_match_radius_km', '15'),
  ('request_expire_minutes', '30')
on conflict (key) do nothing;

-- ============ 2. INVARIANT SATU ORDER AKTIF PER CLIENT & MONTIR ============

-- Jika ada duplikat order aktif lama di DB, batalkan yang lebih lama agar index unik dapat dibuat.
with ranked_client as (
  select id, row_number() over (partition by client_id order by created_at desc) as rn
  from public.service_requests
  where status not in ('paid', 'cancelled')
)
update public.service_requests sr
set status = 'cancelled',
    updated_at = now()
from ranked_client rc
where sr.id = rc.id and rc.rn > 1;

with ranked_mechanic as (
  select id, row_number() over (partition by mechanic_id order by created_at desc) as rn
  from public.service_requests
  where mechanic_id is not null and status not in ('paid', 'cancelled')
)
update public.service_requests sr
set status = 'cancelled',
    updated_at = now()
from ranked_mechanic rm
where sr.id = rm.id and rm.rn > 1;

create unique index if not exists sr_one_active_per_client
  on public.service_requests (client_id)
  where status not in ('paid', 'cancelled');

create unique index if not exists sr_one_active_per_mechanic
  on public.service_requests (mechanic_id)
  where mechanic_id is not null and status not in ('paid', 'cancelled');

-- Pembuatan order wajib melalui RPC create_service_request.
drop policy if exists sr_insert_client on public.service_requests;

-- ============ 3. PRIVACY-SAFE DISCOVERY VIEWS & RPCS ============

create or replace function public.mask_address_area(p_address text)
returns text
language plpgsql
immutable
as $$
declare
  v_clean text := btrim(coalesce(p_address, ''));
  v_parts text[];
  v_len int;
begin
  if v_clean = '' then
    return 'Lokasi di sekitar area';
  end if;
  v_parts := regexp_split_to_array(v_clean, '\s*,\s*');
  v_len := coalesce(array_length(v_parts, 1), 0);
  if v_len >= 2 then
    return v_parts[v_len - 1] || ', ' || v_parts[v_len];
  end if;
  return v_clean;
end;
$$;

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
where mp.is_online = true
  and mp.is_verified = true
  and mp.is_available = true;

revoke all on public.mechanic_directory from public, anon;
grant select on public.mechanic_directory to authenticated;

create or replace function public.list_nearby_mechanics(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km numeric default 15,
  p_limit int default 10
)
returns table (
  profile_id uuid,
  full_name text,
  avatar_url text,
  workshop_name text,
  workshop_address text,
  bio text,
  experience_years int,
  skills text[],
  vehicle_specialization text[],
  certifications text[],
  workshop_photo text,
  rating_avg numeric,
  rating_count int,
  total_jobs int,
  is_online boolean,
  is_available boolean,
  is_verified boolean,
  verified_at timestamptz,
  distance_km numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with origin as (
    select case
      when p_lat is not null and p_lng is not null
        and p_lat between -90 and 90 and p_lng between -180 and 180
      then extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
      else null
    end as pt
  )
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
    mp.verified_at,
    case
      when o.pt is not null and mp.location is not null
      then round((extensions.ST_Distance(mp.location, o.pt) / 1000.0)::numeric, 1)
      else null
    end as distance_km
  from public.mechanic_profiles mp
  join public.profiles p on p.id = mp.profile_id
  cross join origin o
  where mp.is_online = true
    and mp.is_verified = true
    and mp.is_available = true
    and (
      o.pt is null
      or mp.location is null
      or extensions.ST_DWithin(
        mp.location,
        o.pt,
        (greatest(coalesce(p_radius_km, 15), 1) * 1000.0)::double precision
      )
    )
  order by
    case when o.pt is not null and mp.location is not null
      then extensions.ST_Distance(mp.location, o.pt)
      else 1e12
    end asc,
    mp.rating_avg desc,
    mp.total_jobs desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke all on function public.list_nearby_mechanics(double precision, double precision, numeric, int) from public, anon;
grant execute on function public.list_nearby_mechanics(double precision, double precision, numeric, int) to authenticated;

-- View request terbuka untuk montir terverifikasi: TANPA contact_phone, plat nomor, atau koordinat presisi.
drop view if exists public.mechanic_open_request_view;
create view public.mechanic_open_request_view
with (security_invoker = false)
as
select
  sr.id,
  sr.client_id,
  sr.status,
  sr.issue_description,
  sr.symptoms,
  public.mask_address_area(sr.address) as address_area,
  case
    when caller.location is not null and sr.location is not null
    then round((extensions.ST_Distance(caller.location, sr.location) / 1000.0)::numeric, 1)
    else null
  end as distance_km,
  sr.additional_notes,
  sr.created_at,
  p.full_name as client_name,
  p.avatar_url as client_avatar_url,
  coalesce(p.created_at, sr.created_at) as client_joined_at,
  cr.total_requests as client_total_requests,
  v.type as vehicle_type,
  v.brand as vehicle_brand,
  v.model as vehicle_model,
  v.year as vehicle_year,
  v.photo_url as vehicle_photo_url,
  ai.analysis as ai_analysis,
  ai.created_at as ai_created_at
from public.service_requests sr
join public.mechanic_profiles caller
  on caller.profile_id = auth.uid()
 and caller.is_verified = true
left join public.profiles p on p.id = sr.client_id
left join public.vehicles v on v.id = sr.vehicle_id
left join lateral (
  select count(*)::int as total_requests
  from public.service_requests sr2
  where sr2.client_id = sr.client_id
) cr on true
left join lateral (
  select
    jsonb_build_object(
      'possible_issues', d.possible_issues,
      'symptoms_summary', d.symptoms_summary,
      'risk_level', d.risk_level,
      'recommended_checks', d.recommended_checks,
      'suggested_tools', d.suggested_tools,
      'estimated_complexity', d.estimated_complexity,
      'questions_for_client', d.questions_for_client,
      'disclaimer', d.disclaimer,
      'created_at', d.created_at
    ) as analysis,
    d.created_at
  from public.ai_diagnoses d
  where d.request_id = sr.id
  order by d.created_at desc
  limit 1
) ai on true
where sr.mechanic_id is null
  and sr.status = 'requested'
  and public.has_role('mechanic')
  and not exists (
    select 1
    from public.service_request_assignment_rejections rej
    where rej.request_id = sr.id
      and rej.mechanic_id = auth.uid()
  );

revoke all on public.mechanic_open_request_view from public, anon;
grant select on public.mechanic_open_request_view to authenticated;

create or replace function public.list_nearby_open_requests(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km numeric default null,
  p_limit int default 30
)
returns table (
  id uuid,
  status text,
  issue_description text,
  symptoms text,
  address_area text,
  distance_km numeric,
  created_at timestamptz,
  vehicle_type text,
  vehicle_brand text,
  vehicle_model text,
  vehicle_photo_url text,
  client_name text,
  client_avatar_url text,
  ai_analysis jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mech public.mechanic_profiles%rowtype;
  v_origin extensions.geography;
  v_radius_km numeric;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if not public.has_role('mechanic') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_mech
  from public.mechanic_profiles
  where profile_id = v_uid;

  if not found or not v_mech.is_verified then
    raise exception 'MECHANIC_NOT_VERIFIED' using errcode = '42501';
  end if;

  if p_lat is not null and p_lng is not null
     and p_lat between -90 and 90 and p_lng between -180 and 180 then
    v_origin := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;
  else
    v_origin := v_mech.location;
  end if;

  v_radius_km := greatest(
    1,
    coalesce(p_radius_km, v_mech.service_radius_km, public.setting_int('default_match_radius_km', 15)::numeric)
  );

  return query
  select
    sr.id,
    sr.status,
    sr.issue_description,
    sr.symptoms,
    public.mask_address_area(sr.address) as address_area,
    case
      when v_origin is not null and sr.location is not null
      then round((extensions.ST_Distance(v_origin, sr.location) / 1000.0)::numeric, 1)
      else null
    end as distance_km,
    sr.created_at,
    v.type as vehicle_type,
    v.brand as vehicle_brand,
    v.model as vehicle_model,
    v.photo_url as vehicle_photo_url,
    p.full_name as client_name,
    p.avatar_url as client_avatar_url,
    ai.analysis as ai_analysis
  from public.service_requests sr
  left join public.profiles p on p.id = sr.client_id
  left join public.vehicles v on v.id = sr.vehicle_id
  left join lateral (
    select jsonb_build_object(
      'possible_issues', d.possible_issues,
      'symptoms_summary', d.symptoms_summary,
      'risk_level', d.risk_level,
      'recommended_checks', d.recommended_checks,
      'suggested_tools', d.suggested_tools,
      'estimated_complexity', d.estimated_complexity,
      'questions_for_client', d.questions_for_client,
      'disclaimer', d.disclaimer,
      'created_at', d.created_at
    ) as analysis
    from public.ai_diagnoses d
    where d.request_id = sr.id
    order by d.created_at desc
    limit 1
  ) ai on true
  where sr.mechanic_id is null
    and sr.status = 'requested'
    and not exists (
      select 1
      from public.service_request_assignment_rejections rej
      where rej.request_id = sr.id
        and rej.mechanic_id = v_uid
    )
    and (
      v_origin is null
      or sr.location is null
      or extensions.ST_DWithin(v_origin, sr.location, (v_radius_km * 1000.0)::double precision)
    )
  order by
    case when v_origin is not null and sr.location is not null
      then extensions.ST_Distance(v_origin, sr.location)
      else 1e12
    end asc,
    sr.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
end;
$$;

revoke all on function public.list_nearby_open_requests(double precision, double precision, numeric, int) from public, anon;
grant execute on function public.list_nearby_open_requests(double precision, double precision, numeric, int) to authenticated;

-- ============ 4. NOTIFIKASI GEOSPASIAL KE MONTIR TERVERIFIKASI ============

drop trigger if exists trg_notify_mechanics_new_request on public.service_requests;
drop function if exists public.notify_mechanics_new_request();
drop function if exists public.notify_mechanics_open_request(uuid, uuid);

create or replace function public.notify_nearby_mechanics(
  p_request_id uuid,
  p_exclude_mechanic uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_requests%rowtype;
  v_vehicle_type text;
  v_default_radius numeric := greatest(public.setting_int('default_match_radius_km', 15)::numeric, 1);
  v_area text;
  v_body text;
begin
  select * into v_request
  from public.service_requests
  where id = p_request_id;

  if not found or v_request.mechanic_id is not null or v_request.status <> 'requested' then
    return;
  end if;

  if v_request.vehicle_id is not null then
    select v.type into v_vehicle_type
    from public.vehicles v
    where v.id = v_request.vehicle_id;
  end if;

  v_area := public.mask_address_area(v_request.address);
  v_body := left(coalesce(nullif(v_request.issue_description, ''), 'Ada request baru di sekitarmu'), 120)
            || ' · ' || left(v_area, 80);

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  select
    mp.profile_id,
    'Request baru di sekitarmu',
    v_body,
    'new_request',
    'service_request',
    v_request.id
  from public.mechanic_profiles mp
  where mp.is_online = true
    and mp.is_verified = true
    and mp.is_available = true
    and mp.profile_id <> v_request.client_id
    and (p_exclude_mechanic is null or mp.profile_id <> p_exclude_mechanic)
    and not exists (
      select 1
      from public.service_request_assignment_rejections rej
      where rej.request_id = v_request.id
        and rej.mechanic_id = mp.profile_id
    )
    and not exists (
      select 1
      from public.service_requests sr
      where sr.mechanic_id = mp.profile_id
        and sr.status not in ('paid', 'cancelled')
    )
    and (
      v_vehicle_type is null
      or coalesce(array_length(mp.vehicle_specialization, 1), 0) = 0
      or v_vehicle_type = any(mp.vehicle_specialization)
    )
    and (
      v_request.location is null
      or mp.location is null
      or extensions.ST_DWithin(
        mp.location,
        v_request.location,
        (least(coalesce(mp.service_radius_km, v_default_radius), v_default_radius) * 1000.0)::double precision
      )
    );
end;
$$;

revoke all on function public.notify_nearby_mechanics(uuid, uuid) from public, anon, authenticated;
grant execute on function public.notify_nearby_mechanics(uuid, uuid) to service_role;

-- ============ 5. STATE MACHINE RPCS ATOMIK ============

create or replace function public.set_mechanic_online_status(
  p_is_online boolean,
  p_lat double precision default null,
  p_lng double precision default null
)
returns public.mechanic_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.mechanic_profiles%rowtype;
  v_has_active boolean;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if not public.has_role('mechanic') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.mechanic_profiles (profile_id)
  values (v_uid)
  on conflict (profile_id) do nothing;

  select * into v_profile
  from public.mechanic_profiles
  where profile_id = v_uid
  for update;

  if p_is_online and not v_profile.is_verified then
    raise exception 'MECHANIC_NOT_VERIFIED' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.service_requests sr
    where sr.mechanic_id = v_uid and sr.status not in ('paid', 'cancelled')
  ) into v_has_active;

  perform set_config('app.internal_rpc', '1', true);

  update public.mechanic_profiles
  set is_online = p_is_online,
      is_available = not v_has_active,
      current_lat = coalesce(p_lat, current_lat),
      current_lng = coalesce(p_lng, current_lng),
      last_location_at = case
        when p_lat is not null and p_lng is not null then now()
        else last_location_at
      end,
      updated_at = now()
  where profile_id = v_uid
  returning * into v_profile;

  insert into public.activity_logs (user_id, activity_type, description)
  values (
    v_uid,
    'online_status',
    case when p_is_online then 'Montir online, siap menerima order.' else 'Montir offline.' end
  );

  return v_profile;
end;
$$;

revoke all on function public.set_mechanic_online_status(boolean, double precision, double precision) from public, anon;
grant execute on function public.set_mechanic_online_status(boolean, double precision, double precision) to authenticated;

create or replace function public.create_service_request(
  p_vehicle_id uuid default null,
  p_issue_description text default '',
  p_symptoms text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_address text default null,
  p_contact_phone text default '',
  p_additional_notes text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_issue text := btrim(coalesce(p_issue_description, ''));
  v_phone text := btrim(coalesce(p_contact_phone, ''));
  v_request public.service_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if not public.has_role('client') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if char_length(v_issue) < 5 then
    raise exception 'INVALID_ISSUE_DESCRIPTION' using errcode = '22023';
  end if;
  if char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then
    raise exception 'INVALID_CONTACT_PHONE' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'INVALID_COORDINATES' using errcode = '22023';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles v where v.id = p_vehicle_id and v.owner_id = v_uid
  ) then
    raise exception 'INVALID_VEHICLE' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('client:' || v_uid::text, 0));

  if exists (
    select 1 from public.service_requests sr
    where sr.client_id = v_uid and sr.status not in ('paid', 'cancelled')
  ) then
    raise exception 'ACTIVE_ORDER_EXISTS' using errcode = 'P0001';
  end if;

  insert into public.service_requests (
    client_id, vehicle_id, issue_description, symptoms,
    lat, lng, address, contact_phone, additional_notes, status
  ) values (
    v_uid,
    p_vehicle_id,
    v_issue,
    nullif(btrim(coalesce(p_symptoms, '')), ''),
    p_lat,
    p_lng,
    nullif(btrim(coalesce(p_address, '')), ''),
    v_phone,
    nullif(btrim(coalesce(p_additional_notes, '')), ''),
    'requested'
  )
  returning * into v_request;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values
    (v_request.id, null, 'requested', v_uid, 'Permintaan bantuan dibuat oleh client.');

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'request_created',
    'Membuat permintaan bantuan #' || upper(left(v_request.id::text, 8)) || '.',
    'service_request',
    v_request.id
  );

  perform public.notify_nearby_mechanics(v_request.id, null);

  return v_request;
end;
$$;

revoke all on function public.create_service_request(uuid, text, text, double precision, double precision, text, text, text) from public, anon;
grant execute on function public.create_service_request(uuid, text, text, double precision, double precision, text, text, text) to authenticated;

-- Perbarui expire_stale_assignments agar membebaskan is_available & memanggil notify_nearby_mechanics.
create or replace function public.expire_stale_assignments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
  v_short_id text;
begin
  perform set_config('app.internal_rpc', '1', true);

  for v_row in
    select id, client_id, mechanic_id
    from public.service_requests
    where status = 'mechanic_assigned'
      and assignment_expires_at is not null
      and assignment_expires_at <= now()
    for update skip locked
  loop
    v_short_id := upper(left(v_row.id::text, 8));

    update public.service_requests
    set status = 'requested',
        mechanic_id = null,
        assignment_requested_at = null,
        assignment_expires_at = null
    where id = v_row.id;

    if v_row.mechanic_id is not null then
      update public.mechanic_profiles
      set is_available = not exists (
        select 1 from public.service_requests sr
        where sr.mechanic_id = v_row.mechanic_id
          and sr.status not in ('paid', 'cancelled')
      )
      where profile_id = v_row.mechanic_id;

      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values (
        v_row.mechanic_id,
        'Pengajuan montir kedaluwarsa',
        'Client tidak merespons pengajuanmu untuk pesanan #' || v_short_id || '. Pesanan kembali ke kolam.',
        'assignment_expired',
        'service_request',
        v_row.id
      );
    end if;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, changed_by, notes)
    values
      (v_row.id, 'mechanic_assigned', 'requested', null,
       'Pengajuan montir kedaluwarsa karena client tidak merespons.');

    insert into public.notifications
      (user_id, title, body, type, related_entity_type, related_entity_id)
    values (
      v_row.client_id,
      'Konfirmasi montir kedaluwarsa',
      'Waktu konfirmasi untuk pesanan #' || v_short_id || ' habis. Pesanan kembali mencari montir.',
      'assignment_expired',
      'service_request',
      v_row.id
    );

    perform public.notify_nearby_mechanics(v_row.id, v_row.mechanic_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Auto-expire request terbuka yang tidak diambil montir melebihi batas waktu (default 30 menit).
create or replace function public.expire_stale_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expire_minutes integer := greatest(public.setting_int('request_expire_minutes', 30), 5);
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select id, client_id
    from public.service_requests
    where status = 'requested'
      and mechanic_id is null
      and created_at <= now() - make_interval(mins => v_expire_minutes)
    for update skip locked
  loop
    update public.service_requests
    set status = 'cancelled',
        updated_at = now()
    where id = v_row.id;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, changed_by, notes)
    values
      (v_row.id, 'requested', 'cancelled', null,
       'Permintaan kedaluwarsa otomatis karena belum ada montir yang mengambil.');

    insert into public.notifications
      (user_id, title, body, type, related_entity_type, related_entity_id)
    values (
      v_row.client_id,
      'Permintaan berakhir',
      'Belum ada montir yang tersedia untuk pesanan #' || upper(left(v_row.id::text, 8)) || '. Silakan ajukan ulang.',
      'request_expired',
      'service_request',
      v_row.id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_stale_requests() from public, anon, authenticated;
grant execute on function public.expire_stale_requests() to service_role;

create or replace function public.accept_service_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_mech public.mechanic_profiles%rowtype;
  v_from_status text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if not public.has_role('mechanic') then
    raise exception 'Hanya akun montir yang bisa menerima request.' using errcode = '42501';
  end if;

  select * into v_mech
  from public.mechanic_profiles
  where profile_id = v_uid;

  if not found or not v_mech.is_verified then
    raise exception 'MECHANIC_NOT_VERIFIED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  -- Jika baris ini masih mechanic_assigned namun sudah lewat waktu, bebaskan dulu hanya baris ini.
  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request tidak ditemukan.' using errcode = 'P0002';
  end if;

  if v_request.status = 'mechanic_assigned'
     and v_request.assignment_expires_at is not null
     and v_request.assignment_expires_at <= now() then
    perform set_config('app.internal_rpc', '1', true);
    if v_request.mechanic_id is not null then
      update public.mechanic_profiles
      set is_available = true
      where profile_id = v_request.mechanic_id;
    end if;
    update public.service_requests
    set status = 'requested',
        mechanic_id = null,
        assignment_requested_at = null,
        assignment_expires_at = null
    where id = p_request_id
    returning * into v_request;
  end if;

  -- Idempotent klik ganda montir yang sama.
  if v_request.mechanic_id = v_uid
     and v_request.status = 'mechanic_assigned'
     and (v_request.assignment_expires_at is null or v_request.assignment_expires_at > now()) then
    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status,
      'mechanic_id', v_request.mechanic_id,
      'assignment_expires_at', v_request.assignment_expires_at,
      'already_assigned', true
    );
  end if;

  if v_request.mechanic_id is not null then
    raise exception 'Request sudah diambil montir lain.' using errcode = 'P0001';
  end if;

  if v_request.status <> 'requested' then
    raise exception 'Request sudah tidak tersedia.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.service_request_assignment_rejections r
    where r.request_id = p_request_id and r.mechanic_id = v_uid
  ) then
    raise exception 'Client sudah menolak pengajuanmu untuk pesanan ini. Kamu tidak bisa mengajukan lagi.'
      using errcode = 'P0001';
  end if;

  if public.mechanic_active_order_id(v_uid) is not null then
    raise exception 'Kamu masih punya order aktif. Selesaikan order itu sampai lunas sebelum mengambil request baru.'
      using errcode = 'P0001';
  end if;

  v_from_status := v_request.status;
  perform set_config('app.internal_rpc', '1', true);

  update public.service_requests
  set mechanic_id = v_uid,
      status = 'mechanic_assigned',
      accepted_at = null,
      assignment_requested_at = now(),
      assignment_expires_at = now() + interval '5 minutes'
  where id = p_request_id
  returning * into v_request;

  update public.mechanic_profiles
  set is_available = false
  where profile_id = v_uid;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values
    (p_request_id, v_from_status, 'mechanic_assigned', v_uid,
     'Montir mengajukan diri. Menunggu konfirmasi client.');

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'order_assigned',
    'Mengajukan mengambil order #' || upper(left(p_request_id::text, 8)) || '. Menunggu konfirmasi client.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Montir ingin menangani pesananmu',
    'Lihat rating, ulasan, dan data bengkelnya lalu konfirmasi dalam 5 menit.',
    'assignment_requested',
    'service_request',
    p_request_id
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'mechanic_id', v_request.mechanic_id,
    'assignment_expires_at', v_request.assignment_expires_at,
    'already_assigned', false
  );
end;
$$;

create or replace function public.respond_to_assignment(
  p_request_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_request public.service_requests%rowtype;
  v_target_status text;
  v_short_id text;
  v_mech_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if v_action not in ('accept', 'reject', 'reject_and_cancel') then
    raise exception 'Aksi konfirmasi tidak dikenal.' using errcode = '22023';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pesanan tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_request.client_id <> v_uid then
    raise exception 'Hanya client pemilik pesanan yang bisa mengonfirmasi montir.' using errcode = '42501';
  end if;
  if v_request.status <> 'mechanic_assigned' then
    raise exception 'Pengajuan montir sudah tidak aktif.' using errcode = 'P0001';
  end if;
  if v_request.mechanic_id is null then
    raise exception 'Pesanan belum memiliki montir.' using errcode = 'P0001';
  end if;

  v_mech_id := v_request.mechanic_id;
  v_short_id := upper(left(v_request.id::text, 8));

  if v_request.assignment_expires_at is null or v_request.assignment_expires_at <= now() then
    perform set_config('app.internal_rpc', '1', true);
    update public.service_requests
    set status = 'requested',
        mechanic_id = null,
        assignment_requested_at = null,
        assignment_expires_at = null
    where id = p_request_id;
    update public.mechanic_profiles set is_available = true where profile_id = v_mech_id;
    raise exception 'Pengajuan montir sudah kedaluwarsa.' using errcode = 'P0001';
  end if;

  if v_action = 'accept' then
    update public.service_requests
    set status = 'mechanic_accepted',
        accepted_at = now(),
        assignment_expires_at = null
    where id = p_request_id;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, changed_by, notes)
    values
      (p_request_id, 'mechanic_assigned', 'mechanic_accepted', v_uid, 'Client menyetujui montir.');

    insert into public.activity_logs
      (user_id, activity_type, description, related_entity_type, related_entity_id)
    values (
      v_mech_id,
      'order_accepted',
      'Client menyetujui order #' || v_short_id || '.',
      'service_request',
      p_request_id
    );

    insert into public.notifications
      (user_id, title, body, type, related_entity_type, related_entity_id)
    values (
      v_mech_id,
      'Client menyetujui pesananmu',
      'Pesanan #' || v_short_id || ' siap dikerjakan. Mulai perjalanan ke lokasi client.',
      'assignment_confirmed',
      'service_request',
      p_request_id
    );

    return jsonb_build_object(
      'id', p_request_id,
      'status', 'mechanic_accepted',
      'mechanic_id', v_mech_id
    );
  end if;

  if v_action = 'reject' then
    insert into public.service_request_assignment_rejections (request_id, mechanic_id, client_id)
    values (p_request_id, v_mech_id, v_uid)
    on conflict do nothing;
    v_target_status := 'requested';
  else
    v_target_status := 'cancelled';
  end if;

  perform set_config('app.internal_rpc', '1', true);

  update public.service_requests
  set status = v_target_status,
      mechanic_id = null,
      assignment_requested_at = null,
      assignment_expires_at = null
  where id = p_request_id;

  update public.mechanic_profiles
  set is_available = true
  where profile_id = v_mech_id;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    p_request_id,
    'mechanic_assigned',
    v_target_status,
    v_uid,
    case
      when v_target_status = 'cancelled' then 'Client menolak montir dan membatalkan pesanan.'
      else 'Client menolak montir. Pesanan kembali mencari montir.'
    end
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_mech_id,
    case when v_target_status = 'cancelled' then 'Pesanan dibatalkan client' else 'Client menolak pengajuanmu' end,
    case
      when v_target_status = 'cancelled' then 'Pesanan #' || v_short_id || ' dibatalkan client.'
      else 'Pesanan #' || v_short_id || ' kembali ke kolam. Kamu tidak bisa mengajukan lagi untuk pesanan ini.'
    end,
    case when v_target_status = 'cancelled' then 'assignment_cancelled' else 'assignment_rejected' end,
    'service_request',
    p_request_id
  );

  if v_target_status = 'requested' then
    perform public.notify_nearby_mechanics(p_request_id, v_mech_id);
  end if;

  return jsonb_build_object(
    'id', p_request_id,
    'status', v_target_status,
    'mechanic_id', null
  );
end;
$$;

create or replace function public.transition_order_status(
  p_request_id uuid,
  p_to_status text
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_to text := lower(btrim(coalesce(p_to_status, '')));
  v_short_id text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;

  if not (
    (v_request.status = 'mechanic_accepted' and v_to = 'on_the_way')
    or (v_request.status = 'on_the_way' and v_to = 'arrived')
  ) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  v_short_id := upper(left(p_request_id::text, 8));

  update public.service_requests
  set status = v_to,
      arrived_at = case when v_to = 'arrived' then coalesce(arrived_at, now()) else arrived_at end,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    p_request_id,
    case when v_to = 'on_the_way' then 'mechanic_accepted' else 'on_the_way' end,
    v_to,
    v_uid,
    case when v_to = 'on_the_way' then 'Montir mulai menuju lokasi client.' else 'Montir tiba di lokasi client.' end
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    case when v_to = 'arrived' then 'order_arrived' else 'order_status' end,
    case
      when v_to = 'on_the_way' then 'Kamu mulai menuju lokasi order #' || v_short_id || '.'
      else 'Kamu tiba di lokasi order #' || v_short_id || '. Lanjut isi tagihan untuk client.'
    end,
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    case when v_to = 'on_the_way' then 'Montir sedang menuju lokasimu' else 'Montir tiba di lokasi' end,
    case
      when v_to = 'on_the_way' then 'Pantau posisi montir secara langsung untuk pesanan #' || v_short_id || '.'
      else 'Montir sudah tiba di lokasi pesanan #' || v_short_id || '.'
    end,
    'order_status',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

revoke all on function public.transition_order_status(uuid, text) from public, anon;
grant execute on function public.transition_order_status(uuid, text) to authenticated;

create or replace function public.cancel_order(
  p_request_id uuid,
  p_reason text default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_short_id text;
  v_prev_status text;
  v_mech_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_prev_status := v_request.status;
  v_mech_id := v_request.mechanic_id;
  v_short_id := upper(left(p_request_id::text, 8));

  -- 1. Pembatalan oleh client: diizinkan sebelum montir tiba (`arrived`).
  if v_request.client_id = v_uid then
    if v_prev_status not in ('requested', 'mechanic_assigned', 'mechanic_accepted', 'on_the_way') then
      raise exception 'CANNOT_CANCEL_AT_STAGE' using errcode = 'P0001';
    end if;

    perform set_config('app.internal_rpc', '1', true);

    update public.service_requests
    set status = 'cancelled',
        updated_at = now()
    where id = p_request_id
    returning * into v_request;

    if v_mech_id is not null then
      update public.mechanic_profiles
      set is_available = true
      where profile_id = v_mech_id;

      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values (
        v_mech_id,
        'Pesanan dibatalkan client',
        'Pesanan #' || v_short_id || ' dibatalkan oleh client' ||
          case when v_reason is not null then ': ' || left(v_reason, 120) else '.' end,
        'order_cancelled',
        'service_request',
        p_request_id
      );
    end if;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, changed_by, notes)
    values (
      p_request_id,
      v_prev_status,
      'cancelled',
      v_uid,
      coalesce('Dibatalkan client: ' || v_reason, 'Dibatalkan oleh client.')
    );

    insert into public.activity_logs
      (user_id, activity_type, description, related_entity_type, related_entity_id)
    values (
      v_uid,
      'order_cancelled',
      'Membatalkan pesanan #' || v_short_id || '.',
      'service_request',
      p_request_id
    );

    return v_request;
  end if;

  -- 2. Pembatalan oleh montir.
  if v_request.mechanic_id = v_uid then
    perform set_config('app.internal_rpc', '1', true);

    if v_prev_status in ('mechanic_accepted', 'on_the_way') then
      -- Kembalikan ke kolam agar client tetap mendapat montir lain tanpa isi form ulang.
      insert into public.service_request_assignment_rejections (request_id, mechanic_id, client_id)
      values (p_request_id, v_uid, v_request.client_id)
      on conflict do nothing;

      update public.service_requests
      set status = 'requested',
          mechanic_id = null,
          accepted_at = null,
          assignment_requested_at = null,
          assignment_expires_at = null,
          updated_at = now()
      where id = p_request_id
      returning * into v_request;

      update public.mechanic_profiles
      set is_available = true
      where profile_id = v_uid;

      insert into public.service_request_status_history
        (request_id, from_status, to_status, changed_by, notes)
      values (
        p_request_id,
        v_prev_status,
        'requested',
        v_uid,
        coalesce('Montir membatalkan (' || v_reason || '). Pesanan mencari montir lain.',
                 'Montir membatalkan sebelum tiba. Pesanan kembali mencari montir.')
      );

      insert into public.activity_logs
        (user_id, activity_type, description, related_entity_type, related_entity_id)
      values (
        v_uid,
        'order_cancelled',
        'Membatalkan order #' || v_short_id || case when v_reason is not null then ' (' || v_reason || ')' else '' end || '.',
        'service_request',
        p_request_id
      );

      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values (
        v_request.client_id,
        'Montir membatalkan pesanan',
        'Pesanan #' || v_short_id || ' dikembalikan ke pencarian montir terdekat' ||
          case when v_reason is not null then ' (alasan: ' || left(v_reason, 100) || ').' else '.' end,
        'order_reopened',
        'service_request',
        p_request_id
      );

      perform public.notify_nearby_mechanics(p_request_id, v_uid);
      return v_request;
    end if;

    if v_prev_status = 'arrived' then
      update public.service_requests
      set status = 'cancelled',
          updated_at = now()
      where id = p_request_id
      returning * into v_request;

      update public.mechanic_profiles
      set is_available = true
      where profile_id = v_uid;

      insert into public.service_request_status_history
        (request_id, from_status, to_status, changed_by, notes)
      values (
        p_request_id,
        v_prev_status,
        'cancelled',
        v_uid,
        coalesce('Dibatalkan montir: ' || v_reason, 'Dibatalkan oleh montir.')
      );

      insert into public.activity_logs
        (user_id, activity_type, description, related_entity_type, related_entity_id)
      values (
        v_uid,
        'order_cancelled',
        'Membatalkan order #' || v_short_id || case when v_reason is not null then ' (' || v_reason || ')' else '' end || '.',
        'service_request',
        p_request_id
      );

      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values (
        v_request.client_id,
        'Pesanan dibatalkan montir',
        'Pesanan #' || v_short_id || ' dibatalkan oleh montir' ||
          case when v_reason is not null then ': ' || left(v_reason, 120) else '.' end,
        'order_cancelled',
        'service_request',
        p_request_id
      );

      return v_request;
    end if;

    raise exception 'CANNOT_CANCEL_AT_STAGE' using errcode = 'P0001';
  end if;

  raise exception 'NOT_ORDER_PARTICIPANT' using errcode = '42501';
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text) to authenticated;

-- Perbarui RLS order_invoice_items: hanya boleh edit saat status = 'arrived'.
drop policy if exists oii_mechanic_insert on public.order_invoice_items;
create policy oii_mechanic_insert on public.order_invoice_items
  for insert to authenticated
  with check (
    mechanic_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
        and not exists (
          select 1 from public.payments p
          where p.request_id = sr.id and p.status = 'paid'
        )
    )
  );

drop policy if exists oii_mechanic_update on public.order_invoice_items;
create policy oii_mechanic_update on public.order_invoice_items
  for update to authenticated
  using (
    mechanic_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
    )
  )
  with check (
    mechanic_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
    )
  );

drop policy if exists oii_mechanic_delete on public.order_invoice_items;
create policy oii_mechanic_delete on public.order_invoice_items
  for delete to authenticated
  using (
    mechanic_id = auth.uid()
    and exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and sr.mechanic_id = auth.uid()
        and sr.status = 'arrived'
    )
  );

create or replace function public.finalize_order_invoice(p_request_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_min bigint := public.setting_int('min_order_price', 10000)::bigint;
  v_max bigint := public.setting_int('max_order_price', 10000000)::bigint;
  v_total bigint;
  v_item_count integer;
  v_prev_status text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;
  if v_request.status <> 'arrived' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payments where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0)::bigint, count(*)::integer
  into v_total, v_item_count
  from public.order_invoice_items
  where request_id = p_request_id;

  if v_item_count = 0 then
    raise exception 'NO_ITEMS' using errcode = 'P0001';
  end if;
  if v_total < v_min or v_total > v_max then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;

  v_prev_status := v_request.status;

  update public.service_requests
  set price_amount = v_total,
      status = 'payment',
      payment_method = null,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    p_request_id,
    v_prev_status,
    'payment',
    v_uid,
    'Montir mengirim tagihan terperinci ' || v_total::text || ' IDR (' || v_item_count::text || ' baris).'
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'invoice_sent',
    'Tagihan terperinci order #' || upper(left(p_request_id::text, 8)) ||
      ' sebesar Rp' || v_total::text || ' (' || v_item_count::text || ' baris) dikirim ke client.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Tagihan perbaikan siap dibayar',
    'Montir mengirim tagihan terperinci untuk order #' || upper(left(p_request_id::text, 8)) ||
      '. Buka detail order untuk melihat rincian dan membayar.',
    'payment',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

create or replace function public.reopen_order_invoice(p_request_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_short_id text;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.mechanic_id is distinct from v_uid then
    raise exception 'NOT_YOUR_ORDER' using errcode = '42501';
  end if;
  if v_request.status <> 'payment' then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.payments where request_id = p_request_id and status = 'paid'
  ) then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;

  update public.payments
  set status = 'cancelled',
      updated_at = now()
  where request_id = p_request_id
    and status = 'pending';

  update public.service_requests
  set status = 'arrived',
      price_amount = null,
      payment_method = null,
      updated_at = now()
  where id = p_request_id
  returning * into v_request;

  v_short_id := upper(left(p_request_id::text, 8));

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values (
    p_request_id,
    'payment',
    'arrived',
    v_uid,
    'Montir membuka ulang rincian tagihan untuk revisi.'
  );

  insert into public.activity_logs
    (user_id, activity_type, description, related_entity_type, related_entity_id)
  values (
    v_uid,
    'invoice_reopened',
    'Membuka ulang tagihan order #' || v_short_id || ' untuk revisi.',
    'service_request',
    p_request_id
  );

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values (
    v_request.client_id,
    'Tagihan sedang direvisi montir',
    'Montir sedang memperbarui rincian tagihan pesanan #' || v_short_id || '.',
    'payment',
    'service_request',
    p_request_id
  );

  return v_request;
end;
$$;

revoke all on function public.reopen_order_invoice(uuid) from public, anon;
grant execute on function public.reopen_order_invoice(uuid) to authenticated;

-- ============ 6. JADWAL PG_CRON UNTUK KEDALUWARSA REQUEST TERBUKA ============

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'montirgo-expire-requests',
      '* * * * *',
      'select public.expire_stale_requests()'
    );
  end if;
exception when others then
  raise notice 'Jadwal montirgo-expire-requests tidak dibuat: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
