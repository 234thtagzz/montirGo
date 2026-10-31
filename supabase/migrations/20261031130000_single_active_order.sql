-- MontirGo — satu order aktif per montir.
--
-- Montir hanya boleh memegang SATU order yang belum selesai. Order dianggap
-- selesai bila statusnya `paid` (lunas) atau `cancelled`, sehingga montir
-- otomatis bisa mengambil request baru setelah order sebelumnya tuntas.
--
-- Prasyarat: 20261023000000_fix_request_accept_flow.sql sudah dijalankan.
-- Idempotent: aman dijalankan ulang.

-- ---- helper: id order aktif milik montir ----
-- SECURITY DEFINER agar bisa dipakai di dalam policy tabel `service_requests`
-- tanpa rekursi RLS. Pemanggil hanya boleh menanyakan order miliknya sendiri.
create or replace function public.mechanic_active_order_id(p_mechanic_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is not null and p_mechanic_id is distinct from auth.uid() then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select sr.id
    into v_id
  from public.service_requests sr
  where sr.mechanic_id = p_mechanic_id
    and sr.status not in ('paid', 'cancelled')
  order by sr.created_at desc
  limit 1;

  return v_id;
end;
$$;

comment on function public.mechanic_active_order_id(uuid) is
  'ID order yang masih berjalan milik montir (belum lunas/batal). Null bila tidak ada.';

revoke all on function public.mechanic_active_order_id(uuid) from public;
revoke all on function public.mechanic_active_order_id(uuid) from anon;
grant execute on function public.mechanic_active_order_id(uuid) to authenticated;

-- Mempercepat pemeriksaan "masih ada order aktif?".
create index if not exists sr_mechanic_active_idx
  on public.service_requests (mechanic_id, created_at desc)
  where status not in ('paid', 'cancelled');

-- ---- policy ambil order: tolak bila masih memegang order aktif ----
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
    -- `id` adalah baris yang sedang diubah. Order yang sedang berjalan tetap
    -- boleh diperbarui; request lain ditolak selama order aktif belum lunas.
    and (
      public.mechanic_active_order_id(auth.uid()) is null
      or public.mechanic_active_order_id(auth.uid()) = id
    )
  );

-- ---- RPC ambil order (atomik + cek satu order aktif) ----
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
  'Menerima request terbuka secara atomik. Gagal bila sudah diambil montir lain atau montir masih memegang order aktif.';

revoke all on function public.accept_service_request(uuid) from public;
revoke all on function public.accept_service_request(uuid) from anon;
grant execute on function public.accept_service_request(uuid) to authenticated;

-- Supabase PostgREST: muat ulang cache schema.
notify pgrst, 'reload schema';
