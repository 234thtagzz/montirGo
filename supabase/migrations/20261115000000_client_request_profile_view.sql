-- Data client ringkas untuk layar pengajuan request montir.
-- Menambah avatar, tanggal bergabung, dan total pesanan client pada view
-- request terbuka. Nama client tetap memakai kolom `client_name` yang sudah
-- dipakai aplikasi.

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
  sr.address,
  sr.lat,
  sr.lng,
  sr.contact_phone,
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
  v.license_plate as vehicle_plate,
  v.photo_url as vehicle_photo_url,
  ai.analysis as ai_analysis,
  ai.created_at as ai_created_at
from public.service_requests sr
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
  and sr.status in ('requested', 'matching')
  and public.has_role('mechanic');

comment on view public.mechanic_open_request_view is
  'Request terbuka untuk semua montir, termasuk ringkasan client (avatar, tanggal bergabung, total pesanan) dan kendaraan.';

revoke all on public.mechanic_open_request_view from public;
revoke all on public.mechanic_open_request_view from anon;
grant select on public.mechanic_open_request_view to authenticated;

notify pgrst, 'reload schema';
