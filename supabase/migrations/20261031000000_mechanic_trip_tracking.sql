-- Trip mode montir (PRD §12): publikasi posisi realtime + penulisan atomik.
--
-- Tabel `mechanic_locations` dan kolom `mechanic_profiles.current_lat/current_lng`
-- sudah ada sejak migration init, tetapi belum pernah dipakai. Migration ini
-- menambahkan realtime (agar client bisa memantau pada iterasi berikutnya),
-- index pencarian posisi terakhir, dan satu RPC agar penulisan posisi montir
-- tervalidasi di server (bukan hanya di aplikasi).

-- ---- realtime ----
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'mechanic_locations'
     ) then
    alter publication supabase_realtime add table public.mechanic_locations;
  end if;
end $$;

create index if not exists ml_request_time_idx
  on public.mechanic_locations (request_id, recorded_at desc);

-- ---- RPC: simpan satu titik posisi montir ----
-- Validasi: pemanggil harus montir pemilik request dan order sedang dalam
-- perjalanan. Penulisan jejak + posisi profil dilakukan dalam satu transaksi
-- agar `mechanic_profiles` tidak pernah tertinggal dari `mechanic_locations`.
create or replace function public.record_mechanic_location(
  p_request_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mechanic uuid := auth.uid();
begin
  if v_mechanic is null then
    raise exception 'UNAUTHORIZED';
  end if;

  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'INVALID_COORDINATES';
  end if;

  if not exists (
    select 1
    from public.service_requests sr
    where sr.id = p_request_id
      and sr.mechanic_id = v_mechanic
      and sr.status in ('mechanic_accepted', 'on_the_way', 'arrived')
  ) then
    raise exception 'NOT_ACTIVE_TRIP';
  end if;

  insert into public.mechanic_locations (
    mechanic_id, request_id, lat, lng, accuracy_meters
  ) values (
    v_mechanic, p_request_id, p_lat, p_lng, p_accuracy
  );

  update public.mechanic_profiles
     set current_lat = p_lat,
         current_lng = p_lng,
         last_location_at = now(),
         updated_at = now()
   where profile_id = v_mechanic;
end;
$$;

revoke all on function public.record_mechanic_location(
  uuid, double precision, double precision, double precision
) from public;

grant execute on function public.record_mechanic_location(
  uuid, double precision, double precision, double precision
) to authenticated;
