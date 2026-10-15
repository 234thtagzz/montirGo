-- MontirGo — aksi order oleh montir (MVP, tanpa backend Express).
-- Prasyarat: 20261015000000_init_montirgo.sql sudah dijalankan.
-- Idempotent: aman dijalankan ulang.

-- Montir boleh mengambil order terbuka (requested/matching) untuk dirinya sendiri.
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

-- Montir boleh memajukan status order miliknya (termasuk harga final di price_amount).
-- Harga/payment final tetap harus lewat backend/webhook pada fase berikutnya (PRD §17).
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
      'mechanic_accepted', 'on_the_way', 'arrived', 'diagnosing',
      'repairing', 'completed', 'payment', 'paid', 'cancelled'
    )
  );

-- Partisipan (client/montir terkait) boleh mencatat history status ordernya.
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

-- Realtime untuk order masuk & perubahan status (Expo: supabase.channel).
do $$
begin
  alter publication supabase_realtime add table public.service_requests;
exception when duplicate_object then
  null;
end $$;
