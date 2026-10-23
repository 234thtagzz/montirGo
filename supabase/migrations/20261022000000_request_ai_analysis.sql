-- MontirGo — analisis AI saat request dibuat + akses detail request oleh montir.
-- Prasyarat: 20261015000000_init_montirgo.sql & 20261015000001_mechanic_actions.sql.
-- Idempotent: aman dijalankan ulang.
--
-- Alur:
--   client membuat service_request
--     -> Edge Function `analyze-request` menyimpan hasil ke ai_diagnoses
--     -> montir melihat data request + analisis AI di layar Detail Request
--        SEBELUM menerima order (status requested/matching, mechanic_id null).

-- ============ 1. INDEX ANALISIS TERBARU ============
create index if not exists ai_request_created_idx
  on public.ai_diagnoses (request_id, created_at desc);

-- ============ 2. RLS: MONTIR BOLEH BACA ANALISIS REQUEST TERBUKA ============
-- Policy `ai_select_participant` baru berlaku setelah montir menerima order.
-- Sebelum itu montir tetap perlu membaca indikasi awal untuk memutuskan.
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

-- ============ 3. VIEW DETAIL REQUEST TERBUKA UNTUK MONTIR ============
-- Alasan memakai view security definer:
--   * `profiles_select_counterpart` & `vehicles_mechanic_read` hanya terbuka
--     setelah ada relasi service_request yang sudah di-assign.
--   * Supaya tidak melonggarkan RLS profiles (email/telepon) dan vehicles,
--     view ini hanya mengekspos kolom aman yang dibutuhkan montir.
--   * raw_response AI tidak ikut diekspos (bisa besar & tidak perlu).
-- Drop + create agar view lama (buatan manual / versi sebelumnya) benar-benar
-- diganti. `create or replace` gagal bila daftar/tipe kolom view lama berbeda.
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
join public.profiles p on p.id = sr.client_id
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
  'Detail request terbuka untuk montir: data client terbatas, kendaraan, dan analisis AI terbaru.';

revoke all on public.mechanic_open_request_view from public;
revoke all on public.mechanic_open_request_view from anon;
grant select on public.mechanic_open_request_view to authenticated;

-- ============ 4. REALTIME ============
-- Agar kartu analisis AI di layar client/montir ikut ter-update tanpa refresh.
do $$
begin
  alter publication supabase_realtime add table public.ai_diagnoses;
exception when duplicate_object then
  null;
end $$;
