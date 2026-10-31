-- MontirGo — foto & jenis kendaraan untuk analisis montir.
--
-- Perubahan:
--   1. View `mechanic_open_request_view` membawa `photo_url` kendaraan sehingga
--      montir bisa melihat foto sebelum menerima request.
--   2. Helper `vehicle_photo_visible(path)` menentukan foto kendaraan mana yang
--      boleh dibaca montir (request terbuka / order yang ia tangani).
--   3. Policy storage `vehicle-photos`: montir boleh membaca foto kendaraan yang
--      relevan dengan request-nya; pemilik boleh menghapus fotonya sendiri.
--
-- Prasyarat: 20261015000000_init_montirgo.sql, 20261023000000_fix_request_accept_flow.sql.
-- Idempotent: aman dijalankan ulang.

-- ============ 1. HELPER AKSES FOTO ============
-- Security definer agar policy storage bisa memeriksa relasi request tanpa
-- terhalang RLS `vehicles` (montir belum bisa SELECT kendaraan request terbuka).
create or replace function public.vehicle_photo_visible(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehicles v
    join public.service_requests sr on sr.vehicle_id = v.id
    where v.photo_url = p_path
      and (
        v.owner_id = auth.uid()
        or sr.mechanic_id = auth.uid()
        or (sr.mechanic_id is null and sr.status in ('requested', 'matching'))
        or public.has_role('admin')
      )
  );
$$;

comment on function public.vehicle_photo_visible(text) is
  'True bila pengguna berhak melihat foto kendaraan pada path tersebut (pemilik, montir terkait, atau montir request terbuka).';

revoke all on function public.vehicle_photo_visible(text) from public;
grant execute on function public.vehicle_photo_visible(text) to authenticated;

-- ============ 2. POLICY STORAGE ============
drop policy if exists storage_vehicle_photo_read_related on storage.objects;
create policy storage_vehicle_photo_read_related on storage.objects
  for select to authenticated using (
    bucket_id = 'vehicle-photos'
    and public.vehicle_photo_visible(name)
  );

drop policy if exists storage_vehicle_photo_delete_own on storage.objects;
create policy storage_vehicle_photo_delete_own on storage.objects
  for delete to authenticated using (
    bucket_id = 'vehicle-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============ 3. VIEW REQUEST TERBUKA ============
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
  v.photo_url as vehicle_photo_url,
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
  'Request terbuka untuk semua montir (termasuk jenis & foto kendaraan). Hilang otomatis setelah diambil montir.';

revoke all on public.mechanic_open_request_view from public;
revoke all on public.mechanic_open_request_view from anon;
grant select on public.mechanic_open_request_view to authenticated;

notify pgrst, 'reload schema';
