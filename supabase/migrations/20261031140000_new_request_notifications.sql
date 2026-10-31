-- MontirGo — notifikasi request baru untuk montir.
--
-- Setiap kali client membuat request (status `requested`/`matching` tanpa
-- montir), baris `notifications` dibuat untuk semua montir yang sedang online
-- dan belum memegang order aktif. Aplikasi montir memakai baris ini untuk:
--   1. daftar notifikasi in-app (layar Notifikasi),
--   2. notifikasi lokal di HP saat aplikasi berjalan (expo-notifications).
--
-- Prasyarat: 20261015000000_init_montirgo.sql & 20261031130000_single_active_order.sql.
-- Idempotent: aman dijalankan ulang.

create or replace function public.notify_mechanics_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  if new.mechanic_id is not null or new.status not in ('requested', 'matching') then
    return new;
  end if;

  v_body := left(coalesce(nullif(new.issue_description, ''), 'Ada request baru di sekitarmu'), 120);
  if new.address is not null and length(new.address) > 0 then
    v_body := v_body || ' · ' || left(new.address, 80);
  end if;

  insert into public.notifications
    (user_id, title, body, type, related_entity_type, related_entity_id)
  select
    mp.profile_id,
    'Request baru di sekitarmu',
    v_body,
    'new_request',
    'service_request',
    new.id
  from public.mechanic_profiles mp
  where mp.is_online = true
    and mp.is_available = true
    and mp.profile_id <> new.client_id
    -- Montir yang masih memegang order aktif tidak perlu ditawari request baru
    -- karena belum bisa menerimanya (lihat migration single_active_order).
    and not exists (
      select 1
      from public.service_requests sr
      where sr.mechanic_id = mp.profile_id
        and sr.status not in ('paid', 'cancelled')
    );

  return new;
end;
$$;

comment on function public.notify_mechanics_new_request() is
  'Membuat notifikasi in-app untuk montir online saat request baru dibuat.';

drop trigger if exists trg_notify_mechanics_new_request on public.service_requests;
create trigger trg_notify_mechanics_new_request
after insert on public.service_requests
for each row execute function public.notify_mechanics_new_request();

-- Realtime: aplikasi montir mendengarkan INSERT pada notifikasinya sendiri
-- agar bisa langsung menampilkan notifikasi lokal di HP.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
