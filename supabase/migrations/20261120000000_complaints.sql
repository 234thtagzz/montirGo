-- MontirGo — Fitur Keluhan (complaints).
--
-- Tujuan:
--   1. Tabel complaints: keluhan client/montir terhadap transaksi
--      (service_requests). Setiap keluhan wajib punya request_id agar
--      admin dapat mencari transaksi mana yang terdapat keluhannya.
--   2. RLS: reporter hanya bisa select + insert miliknya; status baris
--      (status/admin_reply/resolved) dimanaged-hanya oleh admin.
--   3. Storage: bucket privat `complaint-photos` — path dimulai dengan
--      auth.uid() pelapor (pattern sama `vehicle-photos`/`workshop-photos`).
--   4. View admin_complaint_overview: jembatan halaman "Sengketa" panel
--      admin, dengan data keluahan lengkap (reporter, transaksi, balasan).
--
-- Idempotent: aman dijalankan ulang.

-- ============ 1. TABEL complaints ============
create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  -- Divalidasi di insert & update: default = role pemanggil di sesi ini,
  -- dan harus cocok dengan request_id yang mereporter sebagai client/montir.
  reporter_role text not null default public.current_role()
    check (reporter_role in ('client', 'mechanic') and reporter_role = public.current_role()),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  category text not null
    check (category in ('pesanan', 'pembayaran', 'montir', 'aplikasi', 'lainnya')),
  subject text not null
    check (char_length(trim(subject)) between 5 and 120),
  description text not null
    check (char_length(trim(description)) between 10 and 4000),
  -- Path objek di bucket privat (bukan URL publik).
  photo_paths text[] not null default '{}',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  -- Hanya diisi/diubah oleh admin (lihat policy di bawah).
  admin_reply text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.complaints enable row level security;

create index if not exists complaint_reporter_idx
  on public.complaints (reporter_id, created_at desc);
create index if not exists complaint_request_idx on public.complaints (request_id);
create index if not exists complaint_status_idx
  on public.complaints (status, created_at desc);

-- updated_at setiap baris diubah (pattern public.handle_updated_at).
drop trigger if exists set_complaints_updated_at on public.complaints;
create trigger set_complaints_updated_at
  before update on public.complaints
  for each row execute function public.handle_updated_at();

-- ============ 2. RLS POLICIES ============
-- Pelapor: baca miliknya; insert memakai reporter_id = auth.uid().
drop policy if exists complaint_reporter_own on public.complaints;
create policy complaint_reporter_own on public.complaints
  for select to authenticated using (reporter_id = auth.uid());

drop policy if exists complaint_reporter_insert on public.complaints;
create policy complaint_reporter_insert on public.complaints
  for insert to authenticated
  with check (reporter_id = auth.uid() and reporter_role = public.current_role());

-- Hanya admin yang boleh ubah baris keluahan (status/balasan).
drop policy if exists complaint_admin_update on public.complaints;
create policy complaint_admin_update on public.complaints
  for update to authenticated using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- Admin bisa baca semua (lihat / delete).
drop policy if exists complaint_admin_read on public.complaints;
create policy complaint_admin_read on public.complaints
  for select to authenticated using (public.has_role('admin'));

-- ============ 3. NOTIFIKASI ADMIN SAAT KELUARAN MASUK ============
create or replace function public.notify_complaint_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, type, related_entity_type, related_entity_id)
  select p.id,
         'Keluhan transaksi ' || (select substr(r.issue_description, 1, 50) from public.service_requests r where r.id = new.request_id),
         'Ada keluhan baru terkait transaksi. Lihat di Sengketa.',
         'complaint', 'complaint', new.id
  from public.profiles p
  where p.role = 'admin'::public.app_role;
  return new;
end;
$$;

drop trigger if exists complaint_notify_admin on public.complaints;
create trigger complaint_notify_admin
  after insert on public.complaints
  for each row execute function public.notify_complaint_admin();

-- ============ 4. STORAGE BUCKET complaint-photos ============
insert into storage.buckets (id, name, public)
values ('complaint-photos', 'complaint-photos', false)
on conflict (id) do update set public = false;

-- Policy upload: reporter hanya ke folder pertama = auth.uid().
drop policy if exists complaint_storage_upload on storage.objects;
create policy complaint_storage_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy baca: milik reporter atau admin.
drop policy if exists complaint_storage_select on storage.objects;
create policy complaint_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_role('admin')
    )
  );

-- ============ 5. VIEW untuk HALAMAN SENGKETA ADMIN ============
-- security_invoker = true agar RLS service_requests sama dengan admin.
create or replace view public.admin_complaint_overview
with (security_invoker = true)
as
select
  c.id,
  c.reporter_id,
  c.reporter_role,
  rp.full_name as reporter_name,
  rp.email as reporter_email,
  rp.phone_number as reporter_phone,
  c.category,
  c.subject,
  c.description,
  c.photo_paths,
  c.status,
  c.admin_reply,
  c.resolved_by,
  c.resolved_at,
  c.created_at,
  c.updated_at,
  c.request_id,
  r.issue_description as order_issue,
  r.status as order_status,
  r.created_at as order_created_at
from public.complaints c
join public.service_requests r on r.id = c.request_id
join public.profiles rp on rp.id = c.reporter_id
where public.has_role('admin');

revoke all on public.admin_complaint_overview from public, anon;
grant select on public.admin_complaint_overview to authenticated;

comment on table public.complaints is
  'Keluhan client/montir terhadap transaksi; request_id selalu diisi.';
comment on view public.admin_complaint_overview is
  'Semua keluhan lengkap (reporter, kategori, balasan admin, data transaksi) untuk halaman Sengketa.';
