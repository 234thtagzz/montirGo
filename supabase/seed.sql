-- MontirGo Local / Staging Deterministic Seed Data.
-- Password untuk seluruh akun uji: Password123!
-- Aman dijalankan ulang (idempotent).

do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_password_hash text := extensions.crypt('Password123!', extensions.gen_salt('bf'));

  v_admin_id uuid := '11111111-1111-4111-8111-111111111101';
  v_client1_id uuid := '22222222-2222-4222-8222-222222222201';
  v_client2_id uuid := '22222222-2222-4222-8222-222222222202';
  v_mech1_id uuid := '33333333-3333-4333-8333-333333333301';
  v_mech2_id uuid := '33333333-3333-4333-8333-333333333302';
  v_mech_unverified_id uuid := '33333333-3333-4333-8333-333333333303';

  v_vehicle1_id uuid := '44444444-4444-4444-8444-444444444401';
  v_vehicle2_id uuid := '44444444-4444-4444-8444-444444444402';

  u record;
begin
  -- Pastikan instance_id diambil dari auth.instances bila ada
  select coalesce((select id from auth.instances limit 1), v_instance_id) into v_instance_id;

  for u in
    select * from (
      values
        (v_admin_id, 'admin@montirgo.test', 'Admin MontirGo', '081100000001', 'admin', '3171000000000001'),
        (v_client1_id, 'client1@montirgo.test', 'Budi Santoso', '081200000001', 'client', '3171000000000002'),
        (v_client2_id, 'client2@montirgo.test', 'Siti Aminah', '081200000002', 'client', '3171000000000003'),
        (v_mech1_id, 'mechanic1@montirgo.test', 'Andi Bengkel Jaya', '081300000001', 'mechanic', '3171000000000004'),
        (v_mech2_id, 'mechanic2@montirgo.test', 'Rudi Servis Motor', '081300000002', 'mechanic', '3171000000000005'),
        (v_mech_unverified_id, 'mechanic_unverified@montirgo.test', 'Montir Baru Belum Verifikasi', '081300000003', 'mechanic', '3171000000000006')
    ) as t(id, email, full_name, phone, role, nik)
  loop
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      v_instance_id,
      u.id,
      'authenticated',
      'authenticated',
      u.email,
      v_password_hash,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', u.full_name,
        'phone', u.phone,
        'role', case when u.role = 'admin' then 'client' else u.role end,
        'identity_number', u.nik
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      u.id,
      u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email),
      'email',
      u.id::text,
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do nothing;

    -- Pastikan role admin terset (trigger handle_new_user menurunkan 'admin' ke 'client')
    if u.role = 'admin' then
      update public.profiles
      set role = 'admin'::public.app_role
      where id = u.id;
    end if;

    -- Pastikan NIK tersimpan untuk akun uji
    insert into public.profile_identities (profile_id, identity_number)
    values (u.id, u.nik)
    on conflict (profile_id) do nothing;
  end loop;

  -- Kendaraan uji client
  insert into public.vehicles (id, owner_id, type, brand, model, year, license_plate, notes)
  values
    (v_vehicle1_id, v_client1_id, 'motor', 'Honda', 'Vario 160', 2023, 'B 1234 ABC', 'Warna hitam doff'),
    (v_vehicle2_id, v_client2_id, 'mobil', 'Toyota', 'Avanza', 2021, 'B 5678 DEF', 'Transmisi matic')
  on conflict (id) do nothing;

  -- Profil montir uji (verified & online di Jakarta Pusat / Selatan)
  update public.mechanic_profiles
  set
    workshop_name = 'Bengkel Jaya Motor',
    workshop_address = 'Jl. Sudirman Kav 10, Jakarta Pusat',
    bio = 'Spesialis injeksi, kelistrikan, dan servis darurat motor.',
    experience_years = 7,
    skills = array['kelistrikan', 'aki', 'injeksi', 'ban'],
    vehicle_specialization = array['motor'],
    certifications = array['Teknisi Sepeda Motor — BNSP (2022)'],
    is_verified = true,
    verified_at = now(),
    is_online = true,
    is_available = true,
    current_lat = -6.2088,
    current_lng = 106.8456,
    last_location_at = now(),
    service_radius_km = 15
  where profile_id = v_mech1_id;

  update public.mechanic_profiles
  set
    workshop_name = 'Rudi Auto Care',
    workshop_address = 'Jl. Gatot Subroto No. 45, Jakarta Selatan',
    bio = 'Servis mobil & motor panggilan area Jakarta.',
    experience_years = 10,
    skills = array['mesin', 'starter', 'ac', 'rem'],
    vehicle_specialization = array['motor', 'mobil'],
    certifications = array['Mekanik Otomotif — BLK Jakarta (2020)'],
    is_verified = true,
    verified_at = now(),
    is_online = true,
    is_available = true,
    current_lat = -6.2150,
    current_lng = 106.8500,
    last_location_at = now(),
    service_radius_km = 20
  where profile_id = v_mech2_id;

  update public.mechanic_profiles
  set
    workshop_name = 'Bengkel Uji Belum Verifikasi',
    is_verified = false,
    is_online = false,
    is_available = true,
    current_lat = -6.2100,
    current_lng = 106.8460
  where profile_id = v_mech_unverified_id;
end $$;
