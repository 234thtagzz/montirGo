-- MontirGo — konfirmasi client sebelum montir mulai mengerjakan order.
--
-- Alur baru:
--   requested/matching
--     --(montir menekan "Ajukan ke Client")--> mechanic_assigned
--     --(client menyetujui)------------------> mechanic_accepted
--     --(client menolak / 5 menit habis)-----> requested
--     --(client batal)-----------------------> cancelled
--
-- Selama mechanic_assigned, order belum boleh diproses montir. Hanya client
-- pemilik order yang boleh keluar dari status ini lewat RPC.
--
-- Prasyarat: 20261031130000_single_active_order.sql.
-- Idempotent: aman dijalankan ulang.

-- ============ 1. KOLOM PENGAJUAN ============
alter table public.service_requests
  add column if not exists assignment_requested_at timestamptz,
  add column if not exists assignment_expires_at timestamptz;

comment on column public.service_requests.assignment_requested_at is
  'Waktu montir mengajukan diri untuk mengambil order.';
comment on column public.service_requests.assignment_expires_at is
  'Batas waktu client mengonfirmasi pengajuan montir.';

create index if not exists sr_assignment_pending_idx
  on public.service_requests (assignment_expires_at)
  where status = 'mechanic_assigned';

-- ============ 2. RIWAYAT PENOLAKAN ============
-- Montir yang pernah ditolak client tidak boleh mengajukan lagi ke order yang sama.
create table if not exists public.service_request_assignment_rejections (
  request_id uuid not null references public.service_requests (id) on delete cascade,
  mechanic_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, mechanic_id)
);

alter table public.service_request_assignment_rejections enable row level security;
revoke all on public.service_request_assignment_rejections from public;
revoke all on public.service_request_assignment_rejections from anon;
revoke all on public.service_request_assignment_rejections from authenticated;
grant all on public.service_request_assignment_rejections to service_role;

-- ============ 3. VIEW PROFIL UNTUK KONFIRMASI ============
-- Berbeda dari mechanic_directory yang hanya berisi montir online, view ini
-- tetap menampilkan montir yang sedang assigned walau status online-nya berubah.
-- Hanya memperlihatkan montir yang punya relasi order dengan client pemanggil.
drop view if exists public.mechanic_assignment_profile;

create view public.mechanic_assignment_profile
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
  mp.is_verified,
  mp.verified_at
from public.mechanic_profiles mp
join public.profiles p on p.id = mp.profile_id
where exists (
  select 1
  from public.service_requests sr
  where sr.mechanic_id = mp.profile_id
    and sr.client_id = auth.uid()
);

comment on view public.mechanic_assignment_profile is
  'Profil montir untuk layar konfirmasi client. Hanya montir yang pernah/sedang di-assign ke order milik client pemanggil.';

revoke all on public.mechanic_assignment_profile from public;
revoke all on public.mechanic_assignment_profile from anon;
grant select on public.mechanic_assignment_profile to authenticated;

-- ============ 4. POLICY: MONTIR TIDAK BOLEH MELEWATI KONFIRMASI ============
-- Pengajuan hanya boleh mengubah request menjadi mechanic_assigned. Status
-- mechanic_accepted hanya boleh dihasilkan oleh RPC client di bawah.
drop policy if exists sr_mechanic_accept on public.service_requests;
create policy sr_mechanic_accept on public.service_requests
  for update to authenticated
  using (
    mechanic_id is null
    and status in ('requested', 'matching')
    and public.has_role('mechanic')
  )
  with check (
    mechanic_id = auth.uid()
    and status = 'mechanic_assigned'
    and (
      public.mechanic_active_order_id(auth.uid()) is null
      or public.mechanic_active_order_id(auth.uid()) = id
    )
  );

-- Saat menunggu konfirmasi client, montir tidak boleh memajukan status sendiri.
drop policy if exists sr_mechanic_progress on public.service_requests;
create policy sr_mechanic_progress on public.service_requests
  for update to authenticated
  using (
    mechanic_id = auth.uid()
    and status not in ('paid', 'cancelled', 'mechanic_assigned')
  )
  with check (
    mechanic_id = auth.uid()
    and status in (
      'mechanic_accepted', 'on_the_way', 'arrived',
      'diagnosing', 'repairing', 'completed', 'payment', 'paid', 'cancelled'
    )
  );

-- ============ 5. HELPER: TAWARKAN REQUEST KEMBALI KE KOLAM ============
create or replace function public.notify_mechanics_open_request(
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
  v_body text;
begin
  select * into v_request
  from public.service_requests
  where id = p_request_id;

  if not found
     or v_request.mechanic_id is not null
     or v_request.status not in ('requested', 'matching') then
    return;
  end if;

  v_body := left(
    coalesce(nullif(v_request.issue_description, ''), 'Ada request baru di sekitarmu'),
    120
  );
  if v_request.address is not null and length(v_request.address) > 0 then
    v_body := v_body || ' · ' || left(v_request.address, 80);
  end if;

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  select
    mp.profile_id,
    'Request kembali tersedia',
    v_body,
    'new_request',
    'service_request',
    v_request.id
  from public.mechanic_profiles mp
  where mp.is_online = true
    and mp.is_available = true
    and mp.profile_id <> v_request.client_id
    and (p_exclude_mechanic is null or mp.profile_id <> p_exclude_mechanic)
    and not exists (
      select 1
      from public.service_requests sr
      where sr.mechanic_id = mp.profile_id
        and sr.status not in ('paid', 'cancelled')
    );
end;
$$;

comment on function public.notify_mechanics_open_request(uuid, uuid) is
  'Kirim notifikasi request terbuka ke montir online (opsional kecualikan montir tertentu).';

revoke all on function public.notify_mechanics_open_request(uuid, uuid) from public;
revoke all on function public.notify_mechanics_open_request(uuid, uuid) from anon;
revoke all on function public.notify_mechanics_open_request(uuid, uuid) from authenticated;
grant execute on function public.notify_mechanics_open_request(uuid, uuid) to service_role;

-- ============ 6. HELPER: KEDALUWARSAKAN PENGAJUAN ============
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
  for v_row in
    select id, client_id, mechanic_id
    from public.service_requests
    where status = 'mechanic_assigned'
      and assignment_expires_at is not null
      and assignment_expires_at <= now()
    for update skip locked
  loop
    v_short_id := left(v_row.id::text, 8);

    update public.service_requests
       set status = 'requested',
           mechanic_id = null,
           assignment_requested_at = null,
           assignment_expires_at = null
     where id = v_row.id;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, changed_by, notes)
    values
      (v_row.id, 'mechanic_assigned', 'requested', null,
       'Pengajuan montir kedaluwarsa karena client tidak merespons.');

    insert into public.notifications
      (user_id, title, body, type, related_entity_type, related_entity_id)
    values
      (v_row.client_id,
       'Konfirmasi montir kedaluwarsa',
       'Waktu konfirmasi untuk pesanan #' || upper(v_short_id) ||
         ' habis. Pesanan kembali mencari montir.',
       'assignment_expired',
       'service_request',
       v_row.id);

    if v_row.mechanic_id is not null then
      insert into public.notifications
        (user_id, title, body, type, related_entity_type, related_entity_id)
      values
        (v_row.mechanic_id,
         'Pengajuan montir kedaluwarsa',
         'Client tidak merespons pengajuanmu untuk pesanan #' || upper(v_short_id) ||
           '. Pesanan kembali ke kolam.',
         'assignment_expired',
         'service_request',
         v_row.id);
    end if;

    perform public.notify_mechanics_open_request(v_row.id, v_row.mechanic_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.expire_stale_assignments() is
  'Kembalikan order mechanic_assigned yang melewati batas konfirmasi ke kolam.';

revoke all on function public.expire_stale_assignments() from public;
revoke all on function public.expire_stale_assignments() from anon;
grant execute on function public.expire_stale_assignments() to authenticated;

-- ============ 7. RPC: AJUKAN AMBIL ORDER ============
create or replace function public.accept_service_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.service_requests%rowtype;
  v_from_status text;
begin
  if v_uid is null then
    raise exception 'Sesi berakhir. Silakan login kembali.' using errcode = '28000';
  end if;

  if not public.has_role('mechanic') then
    raise exception 'Hanya akun montir yang bisa menerima request.' using errcode = '42501';
  end if;

  -- Bersihkan pengajuan lama sebelum memeriksa slot montir.
  perform public.expire_stale_assignments();

  -- Kunci baris supaya dua montir tidak bisa menerima request yang sama.
  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request tidak ditemukan.' using errcode = 'P0002';
  end if;

  -- Idempotent: klik ganda dari montir yang sama tidak membuat notifikasi baru.
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

  if v_request.status not in ('requested', 'matching') then
    raise exception 'Request sudah tidak tersedia.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.service_request_assignment_rejections r
    where r.request_id = p_request_id
      and r.mechanic_id = v_uid
  ) then
    raise exception
      'Client sudah menolak pengajuanmu untuk pesanan ini. Kamu tidak bisa mengajukan lagi.'
      using errcode = 'P0001';
  end if;

  -- Serialisasi per montir: dua request yang diterima hampir bersamaan tetap
  -- diproses berurutan sehingga cek order aktif tidak bisa dilewati.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  if public.mechanic_active_order_id(v_uid) is not null then
    raise exception
      'Kamu masih punya order aktif. Selesaikan order itu sampai lunas sebelum mengambil request baru.'
      using errcode = 'P0001';
  end if;

  v_from_status := v_request.status;

  update public.service_requests
     set mechanic_id = v_uid,
         status = 'mechanic_assigned',
         accepted_at = null,
         assignment_requested_at = now(),
         assignment_expires_at = now() + interval '5 minutes'
   where id = p_request_id
   returning * into v_request;

  insert into public.service_request_status_history (
    request_id, from_status, to_status, changed_by, notes
  ) values (
    p_request_id, v_from_status, 'mechanic_assigned', v_uid,
    'Montir mengajukan diri. Menunggu konfirmasi client.'
  );

  insert into public.activity_logs (user_id, activity_type, description)
  values (
    v_uid, 'order_assigned',
    'Mengajukan mengambil order ' || left(p_request_id::text, 8) ||
      '. Menunggu konfirmasi client.'
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

comment on function public.accept_service_request(uuid) is
  'Montir mengajukan mengambil request. Order menunggu konfirmasi client (mechanic_assigned).';

revoke all on function public.accept_service_request(uuid) from public;
revoke all on function public.accept_service_request(uuid) from anon;
grant execute on function public.accept_service_request(uuid) to authenticated;

-- ============ 8. RPC: CLIENT MENJAWAB PENGAJUAN ============
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
begin
  if v_uid is null then
    raise exception 'Sesi berakhir. Silakan login kembali.' using errcode = '28000';
  end if;

  if v_action not in ('accept', 'reject', 'reject_and_cancel') then
    raise exception 'Aksi konfirmasi tidak dikenal.' using errcode = '22023';
  end if;

  -- Pastikan pengajuan yang sudah lewat waktu tidak bisa dikonfirmasi.
  perform public.expire_stale_assignments();

  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pesanan tidak ditemukan.' using errcode = 'P0002';
  end if;

  if v_request.client_id <> v_uid then
    raise exception 'Hanya client pemilik pesanan yang bisa mengonfirmasi montir.'
      using errcode = '42501';
  end if;

  if v_request.status <> 'mechanic_assigned' then
    raise exception 'Pengajuan montir sudah tidak aktif.' using errcode = 'P0001';
  end if;

  if v_request.mechanic_id is null then
    raise exception 'Pesanan belum memiliki montir.' using errcode = 'P0001';
  end if;

  if v_request.assignment_expires_at is null
     or v_request.assignment_expires_at <= now() then
    raise exception 'Pengajuan montir sudah kedaluwarsa.' using errcode = 'P0001';
  end if;

  v_short_id := left(v_request.id::text, 8);

  if v_action = 'accept' then
    update public.service_requests
       set status = 'mechanic_accepted',
           accepted_at = now(),
           assignment_expires_at = null
     where id = p_request_id;

    insert into public.service_request_status_history
      (request_id, from_status, to_status, changed_by, notes)
    values
      (p_request_id, 'mechanic_assigned', 'mechanic_accepted', v_uid,
       'Client menyetujui montir.');

    insert into public.activity_logs (user_id, activity_type, description)
    values
      (v_request.mechanic_id, 'order_accepted',
       'Client menyetujui order ' || left(p_request_id::text, 8) || '.');

    insert into public.notifications
      (user_id, title, body, type, related_entity_type, related_entity_id)
    values
      (v_request.mechanic_id,
       'Client menyetujui pesananmu',
       'Pesanan #' || upper(v_short_id) || ' siap dikerjakan. Mulai perjalanan ke lokasi client.',
       'assignment_confirmed',
       'service_request',
       p_request_id);

    return jsonb_build_object(
      'id', p_request_id,
      'status', 'mechanic_accepted',
      'mechanic_id', v_request.mechanic_id
    );
  end if;

  if v_action = 'reject' then
    insert into public.service_request_assignment_rejections
      (request_id, mechanic_id, client_id)
    values
      (p_request_id, v_request.mechanic_id, v_uid)
    on conflict do nothing;

    v_target_status := 'requested';
  else
    v_target_status := 'cancelled';
  end if;

  update public.service_requests
     set status = v_target_status,
         mechanic_id = null,
         assignment_requested_at = null,
         assignment_expires_at = null
   where id = p_request_id;

  insert into public.service_request_status_history
    (request_id, from_status, to_status, changed_by, notes)
  values
    (p_request_id, 'mechanic_assigned', v_target_status, v_uid,
     case
       when v_target_status = 'cancelled' then 'Client menolak montir dan membatalkan pesanan.'
       else 'Client menolak montir. Pesanan kembali mencari montir.'
     end);

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  values
    (v_request.mechanic_id,
     case
       when v_target_status = 'cancelled' then 'Pesanan dibatalkan client'
       else 'Client menolak pengajuanmu'
     end,
     case
       when v_target_status = 'cancelled' then
         'Pesanan #' || upper(v_short_id) || ' dibatalkan client.'
       else
         'Pesanan #' || upper(v_short_id) || ' kembali ke kolam. Kamu tidak bisa mengajukan lagi untuk pesanan ini.'
     end,
     case
       when v_target_status = 'cancelled' then 'assignment_cancelled'
       else 'assignment_rejected'
     end,
     'service_request',
     p_request_id);

  if v_target_status = 'requested' then
    perform public.notify_mechanics_open_request(p_request_id, v_request.mechanic_id);
  end if;

  return jsonb_build_object(
    'id', p_request_id,
    'status', v_target_status,
    'mechanic_id', null
  );
end;
$$;

comment on function public.respond_to_assignment(uuid, text) is
  'Client menyetujui, menolak, atau menolak sekaligus membatalkan pengajuan montir.';

revoke all on function public.respond_to_assignment(uuid, text) from public;
revoke all on function public.respond_to_assignment(uuid, text) from anon;
grant execute on function public.respond_to_assignment(uuid, text) to authenticated;

-- ============ 9. KEDALUWARSA OTOMATIS (PG_CRON) ============
-- Pengajuan yang tidak dijawab client harus kembali ke kolam tanpa menunggu
-- aplikasi dibuka. Bila pg_cron tersedia, jalankan pemeriksaan tiap menit.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $cron$
      select cron.schedule(
        'montirgo-expire-assignments',
        '* * * * *',
        'select public.expire_stale_assignments()'
      )
    $cron$;
  else
    raise notice 'pg_cron tidak tersedia; kedaluwarsa pengajuan mengandalkan pemanggilan RPC dari aplikasi.';
  end if;
exception when others then
  -- Jangan gagalkan migrasi bila ekstensi/jadwal tidak diizinkan di project.
  raise notice 'Jadwal kedaluwarsa pengajuan tidak dibuat: %', sqlerrm;
end $$;

-- ============ 10. REALTIME ============
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'service_requests'
     ) then
    alter publication supabase_realtime add table public.service_requests;
  end if;
end $$;

notify pgrst, 'reload schema';
