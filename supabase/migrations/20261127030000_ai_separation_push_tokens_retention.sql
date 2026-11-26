-- MontirGo Phase 4: AI chat isolation, AI rate limiting, push tokens, route snapshot & data retention.

-- ============ 1. PISAHKAN CHAT ASISTEN DARI AI DIAGNOSES ============
create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid references public.service_requests (id) on delete set null,
  mode text not null default 'diagnose'
    check (mode in ('diagnose', 'diagnosa', 'sparepart')),
  persona text not null default 'client'
    check (persona in ('client', 'mechanic', 'admin')),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model_used text,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_user_idx
  on public.ai_chat_messages (user_id, created_at desc);

create index if not exists ai_chat_request_idx
  on public.ai_chat_messages (request_id, created_at desc)
  where request_id is not null;

alter table public.ai_chat_messages enable row level security;

drop policy if exists ai_chat_select_own on public.ai_chat_messages;
create policy ai_chat_select_own on public.ai_chat_messages
  for select to authenticated
  using (user_id = auth.uid() or public.has_role('admin'));

drop policy if exists ai_chat_insert_own on public.ai_chat_messages;
create policy ai_chat_insert_own on public.ai_chat_messages
  for insert to authenticated
  with check (user_id = auth.uid());

-- ============ 2. AI USAGE LOGS & RATE LIMITING ============
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null check (endpoint in ('analyze-request', 'ai-assistant')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_endpoint_idx
  on public.ai_usage_logs (user_id, endpoint, created_at desc);

alter table public.ai_usage_logs enable row level security;

create or replace function public.check_and_log_ai_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_per_hour integer default 30,
  p_max_per_day integer default 150
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour_count integer;
  v_day_count integer;
  v_oldest_hour timestamptz;
  v_oldest_day timestamptz;
  v_retry_after integer := 60;
begin
  if p_user_id is null or p_endpoint not in ('analyze-request', 'ai-assistant') then
    raise exception 'INVALID_ARGUMENT' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_endpoint, 0));

  select count(*)::integer, min(created_at)
  into v_hour_count, v_oldest_hour
  from public.ai_usage_logs
  where user_id = p_user_id
    and endpoint = p_endpoint
    and created_at >= now() - interval '1 hour';

  if v_hour_count >= greatest(coalesce(p_max_per_hour, 30), 1) then
    v_retry_after := greatest(
      60,
      ceil(extract(epoch from ((v_oldest_hour + interval '1 hour') - now())))::integer
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'hourly_limit_exceeded',
      'hourly_count', v_hour_count,
      'retry_after_seconds', v_retry_after
    );
  end if;

  select count(*)::integer, min(created_at)
  into v_day_count, v_oldest_day
  from public.ai_usage_logs
  where user_id = p_user_id
    and endpoint = p_endpoint
    and created_at >= now() - interval '24 hours';

  if v_day_count >= greatest(coalesce(p_max_per_day, 150), 1) then
    v_retry_after := greatest(
      60,
      ceil(extract(epoch from ((v_oldest_day + interval '24 hours') - now())))::integer
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'daily_count', v_day_count,
      'retry_after_seconds', v_retry_after
    );
  end if;

  insert into public.ai_usage_logs (user_id, endpoint)
  values (p_user_id, p_endpoint);

  return jsonb_build_object(
    'allowed', true,
    'hourly_count', v_hour_count + 1,
    'daily_count', v_day_count + 1
  );
end;
$$;

-- ============ 3. REMOTE PUSH TOKENS ============
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios', 'web')),
  device_name text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dpt_user_active_idx
  on public.device_push_tokens (user_id, is_active);

drop trigger if exists set_dpt_updated_at on public.device_push_tokens;
create trigger set_dpt_updated_at
  before update on public.device_push_tokens
  for each row execute function public.handle_updated_at();

alter table public.device_push_tokens enable row level security;

drop policy if exists dpt_select_own on public.device_push_tokens;
create policy dpt_select_own on public.device_push_tokens
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists dpt_insert_own on public.device_push_tokens;
create policy dpt_insert_own on public.device_push_tokens
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists dpt_update_own on public.device_push_tokens;
create policy dpt_update_own on public.device_push_tokens
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists dpt_delete_own on public.device_push_tokens;
create policy dpt_delete_own on public.device_push_tokens
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.upsert_my_push_token(
  p_token text,
  p_platform text,
  p_device_name text default null
)
returns public.device_push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := trim(coalesce(p_token, ''));
  v_row public.device_push_tokens;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;
  if length(v_token) < 10 or length(v_token) > 512 then
    raise exception 'INVALID_PUSH_TOKEN' using errcode = '22023';
  end if;
  if p_platform not in ('android', 'ios', 'web') then
    raise exception 'INVALID_PLATFORM' using errcode = '22023';
  end if;

  insert into public.device_push_tokens
    (user_id, expo_push_token, platform, device_name, is_active, last_seen_at)
  values
    (v_uid, v_token, p_platform, left(nullif(trim(p_device_name), ''), 120), true, now())
  on conflict (expo_push_token) do update
    set user_id = v_uid,
        platform = excluded.platform,
        device_name = coalesce(excluded.device_name, public.device_push_tokens.device_name),
        is_active = true,
        last_seen_at = now(),
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.deactivate_my_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := trim(coalesce(p_token, ''));
begin
  if v_uid is null or v_token = '' then
    return;
  end if;

  update public.device_push_tokens
  set is_active = false,
      updated_at = now()
  where expo_push_token = v_token
    and user_id = v_uid;
end;
$$;

-- ============ 4. ROUTE SNAPSHOT PADA SERVICE REQUESTS ============
alter table public.service_requests
  add column if not exists route_polyline text,
  add column if not exists route_distance_m integer,
  add column if not exists route_duration_s integer,
  add column if not exists route_updated_at timestamptz;

drop function if exists public.record_mechanic_location(
  uuid, double precision, double precision, double precision
);

create or replace function public.record_mechanic_location(
  p_request_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_route_polyline text default null,
  p_route_distance_m integer default null,
  p_route_duration_s integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mechanic uuid := auth.uid();
  v_polyline text := nullif(trim(coalesce(p_route_polyline, '')), '');
begin
  if v_mechanic is null then
    raise exception 'UNAUTHORIZED' using errcode = '28000';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'INVALID_COORDINATES' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.service_requests sr
    where sr.id = p_request_id
      and sr.mechanic_id = v_mechanic
      and sr.status in ('mechanic_accepted', 'on_the_way', 'arrived')
  ) then
    raise exception 'NOT_ACTIVE_TRIP' using errcode = 'P0001';
  end if;

  insert into public.mechanic_locations (
    mechanic_id, request_id, lat, lng, accuracy_meters
  ) values (
    v_mechanic, p_request_id, p_lat, p_lng, p_accuracy
  );

  perform set_config('app.internal_rpc', '1', true);

  update public.mechanic_profiles
  set current_lat = p_lat,
      current_lng = p_lng,
      last_location_at = now(),
      updated_at = now()
  where profile_id = v_mechanic;

  if v_polyline is not null and length(v_polyline) <= 32768 then
    update public.service_requests
    set route_polyline = v_polyline,
        route_distance_m = p_route_distance_m,
        route_duration_s = p_route_duration_s,
        route_updated_at = now(),
        updated_at = now()
    where id = p_request_id
      and mechanic_id = v_mechanic;
  end if;
end;
$$;

-- ============ 5. DATA RETENTION & CRON HARIAN ============
create or replace function public.cleanup_old_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loc_deleted integer := 0;
  v_notif_deleted integer := 0;
  v_act_deleted integer := 0;
  v_ai_deleted integer := 0;
begin
  delete from public.mechanic_locations
  where recorded_at < now() - interval '30 days';
  get diagnostics v_loc_deleted = row_count;

  delete from public.notifications
  where is_read = true
    and created_at < now() - interval '90 days';
  get diagnostics v_notif_deleted = row_count;

  delete from public.activity_logs
  where created_at < now() - interval '180 days';
  get diagnostics v_act_deleted = row_count;

  delete from public.ai_usage_logs
  where created_at < now() - interval '30 days';
  get diagnostics v_ai_deleted = row_count;

  return jsonb_build_object(
    'mechanic_locations_deleted', v_loc_deleted,
    'notifications_deleted', v_notif_deleted,
    'activity_logs_deleted', v_act_deleted,
    'ai_usage_logs_deleted', v_ai_deleted
  );
end;
$$;

-- ============ 6. HAK EKSEKUSI ============
revoke all on function public.check_and_log_ai_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_and_log_ai_rate_limit(uuid, text, integer, integer) to service_role;

revoke all on function public.upsert_my_push_token(text, text, text) from public, anon;
grant execute on function public.upsert_my_push_token(text, text, text) to authenticated;

revoke all on function public.deactivate_my_push_token(text) from public, anon;
grant execute on function public.deactivate_my_push_token(text) to authenticated;

revoke all on function public.record_mechanic_location(
  uuid, double precision, double precision, double precision, text, integer, integer
) from public, anon;
grant execute on function public.record_mechanic_location(
  uuid, double precision, double precision, double precision, text, integer, integer
) to authenticated;

revoke all on function public.cleanup_old_operational_data() from public, anon, authenticated;
grant execute on function public.cleanup_old_operational_data() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'montirgo-retention-cleanup';

    perform cron.schedule(
      'montirgo-retention-cleanup',
      '0 3 * * *',
      'select public.cleanup_old_operational_data();'
    );
  end if;
exception
  when others then null;
end $$;
