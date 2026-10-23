-- MontirGo — perbaikan alur request: ambil order secara atomik + daftar request terbuka.
-- Prasyarat: 20261015000000_init_montirgo.sql sudah dijalankan.
-- Idempotent: aman dijalankan ulang.
--
-- Masalah yang diperbaiki:
--   1. Database production belum memiliki policy `sr_mechanic_accept` /
--      `sr_mechanic_progress` (migrasi 20261015000001 belum terpasang), sehingga
--      update "Terima Order" oleh montir mengenai 0 baris. Di UI ini tampak
--      seperti "request sudah diambil montir lain" padahal belum ada montir.
--   2. View `mechanic_open_request_view` bisa kosong / memakai definisi lama,
--      sehingga request yang masih terbuka tidak muncul di tab Request.
--   3. Dua montir bisa menekan "Terima" bersamaan. RPC di bawah mengunci baris
--      request sehingga hanya satu montir yang berhasil.

-- ============ 1. PASTIKAN RLS AKTIF ============
alter table public.service_requests enable row level security;
alter table public.service_request_status_history enable row level security;
alter table public.ai_diagnoses enable row level security;

-- Realtime dengan filter kolom (mis. client_id=eq...) butuh replica identity full.
alter table public.service_requests replica identity full;

-- Mempercepat daftar request terbuka + pengambilan analisis AI terbaru.
create index if not exists sr_open_request_idx
  on public.service_requests (created_at desc)
  where mechanic_id is null and status in ('requested', 'matching');

create index if not exists ai_request_created_idx
  on public.ai_diagnoses (request_id, created_at desc);

-- ============ 2. POLICY AKSI MONTIR ============
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
    and status in ('mechanic_accepted', 'cancelled')
  );

drop policy if exists sr_mechanic_progress on public.service_requests;
create policy sr_mechanic_progress on public.service_requests
  for update to authenticated
  using (
    mechanic_id = auth.uid()
    and status not in ('paid', 'cancelled')
  )
  with check (
    mechanic_id = auth.uid()
    and status in (
      'mechanic_assigned', 'mechanic_accepted', 'on_the_way', 'arrived',
      'diagnosing', 'repairing', 'completed', 'payment', 'paid', 'cancelled'
    )
  );

drop policy if exists srsh_insert_participant on public.service_request_status_history;
create policy srsh_insert_participant on public.service_request_status_history
  for insert to authenticated with check (
    exists (
      select 1 from public.service_requests sr
      where sr.id = request_id
        and (sr.client_id = auth.uid() or sr.mechanic_id = auth.uid())
    )
    and (changed_by is null or changed_by = auth.uid())
  );

-- Pastikan role authenticated punya hak DML (RLS tetap yang membatasi baris).
grant select, insert, update on public.service_requests to authenticated;
grant select, insert on public.service_request_status_history to authenticated;

-- ============ 3. RPC AMBIL ORDER (ATOMIK) ============
-- SECURITY DEFINER: perubahan status order sengaja tidak bergantung pada policy
-- client. Validasi role + kepemilikan dilakukan di dalam fungsi.
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

  -- Kunci baris supaya dua montir tidak bisa menerima request yang sama.
  select * into v_request
  from public.service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request tidak ditemukan.' using errcode = 'P0002';
  end if;

  if v_request.mechanic_id is not null then
    raise exception 'Request sudah diambil montir lain.' using errcode = 'P0001';
  end if;

  if v_request.status not in ('requested', 'matching') then
    raise exception 'Request sudah tidak tersedia.' using errcode = 'P0001';
  end if;

  v_from_status := v_request.status;

  update public.service_requests
     set mechanic_id = v_uid,
         status = 'mechanic_accepted',
         accepted_at = now()
   where id = p_request_id
   returning * into v_request;

  insert into public.service_request_status_history (
    request_id, from_status, to_status, changed_by, notes
  ) values (
    p_request_id, v_from_status, 'mechanic_accepted', v_uid, 'Montir menerima order.'
  );

  insert into public.activity_logs (user_id, activity_type, description)
  values (
    v_uid, 'order_accepted',
    'Menerima order ' || left(p_request_id::text, 8) || '.'
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status,
    'mechanic_id', v_request.mechanic_id,
    'accepted_at', v_request.accepted_at
  );
end;
$$;

comment on function public.accept_service_request(uuid) is
  'Menerima request terbuka secara atomik. Gagal bila sudah diambil montir lain.';

revoke all on function public.accept_service_request(uuid) from public;
revoke all on function public.accept_service_request(uuid) from anon;
grant execute on function public.accept_service_request(uuid) to authenticated;

-- ============ 4. VIEW REQUEST TERBUKA ============
-- Drop + create agar opsi security_invoker dan kolom benar-benar ter-reset,
-- termasuk bila view lama dibuat manual dengan definisi berbeda.
drop view if exists public.mechanic_open_request_view;

create view public.mechanic_open_request_view
with (security_invoker = false)
as
select
  sr.id,
  sr.status,
  sr.issue_description,
  sr.symptoms,
  sr.address,
  sr.lat,
  sr.lng,
  sr.contact_phone,
  sr.additional_notes,
  sr.created_at,
  p.full_name as client_name,
  v.type as vehicle_type,
  v.brand as vehicle_brand,
  v.model as vehicle_model,
  v.year as vehicle_year,
  v.license_plate as vehicle_plate,
  ai.analysis as ai_analysis,
  ai.created_at as ai_created_at
from public.service_requests sr
left join public.profiles p on p.id = sr.client_id
left join public.vehicles v on v.id = sr.vehicle_id
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
  and sr.status in ('requested', 'matching')
  and public.has_role('mechanic');

comment on view public.mechanic_open_request_view is
  'Request terbuka untuk semua montir. Hilang otomatis setelah diambil montir (mechanic_id terisi).';

revoke all on public.mechanic_open_request_view from public;
revoke all on public.mechanic_open_request_view from anon;
grant select on public.mechanic_open_request_view to authenticated;

-- ============ 5. POLICY AI UNTUK REQUEST TERBUKA ============
drop policy if exists ai_select_open_for_mechanics on public.ai_diagnoses;
create policy ai_select_open_for_mechanics on public.ai_diagnoses
  for select to authenticated using (
    public.has_role('mechanic')
    and exists (
      select 1 from public.service_requests sr
      where sr.id = ai_diagnoses.request_id
        and sr.mechanic_id is null
        and sr.status in ('requested', 'matching')
    )
  );

-- ============ 6. VIEW DIREKTORI MONTIR ONLINE ============
-- Ikut dibuat ulang di sini agar tetap ada walau migrasi 20261019 sudah
-- tercatat di riwayat remote namun view-nya hilang.
drop view if exists public.mechanic_directory;

create view public.mechanic_directory
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

revoke all on public.mechanic_directory from public;
revoke all on public.mechanic_directory from anon;
grant select on public.mechanic_directory to authenticated;

-- ============ 7. REALTIME ============
do $$
begin
  alter publication supabase_realtime add table public.service_requests;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ai_diagnoses;
exception when duplicate_object then
  null;
end $$;

-- Supabase PostgREST: muat ulang cache schema agar RPC/view baru langsung dikenali.
notify pgrst, 'reload schema';
