// Data layer section client — langsung ke Supabase; otorisasi dijaga RLS (PRD §6/§22).
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/features/service-request/status';
import type {
  ClientNotification,
  ClientOrder,
  ClientVehicle,
  CreateServiceRequestInput,
  NearbyMechanic,
  OrderStatusEvent,
  VehicleInput,
} from './types';

export * from './types';

const ORDER_SELECT =
  'id, status, issue_description, symptoms, address, contact_phone, additional_notes, ' +
  'price_amount, payment_method, created_at, updated_at, vehicle_id, mechanic_id, ' +
  'vehicles ( type, brand, model, year, license_plate, photo_url ), ' +
  'mechanic:profiles!service_requests_mechanic_id_fkey ( full_name, phone_number, avatar_url )';

interface RawOrder {
  id: string;
  status: string;
  issue_description: string;
  symptoms: string | null;
  address: string | null;
  contact_phone: string;
  additional_notes: string | null;
  price_amount: number | null;
  payment_method: 'online' | 'cash' | null;
  created_at: string;
  updated_at: string;
  vehicle_id: string | null;
  mechanic_id: string | null;
  vehicles: {
    type?: string;
    brand?: string;
    model?: string;
    year?: number | null;
    license_plate?: string;
    photo_url?: string | null;
  } | null;
  mechanic: { full_name?: string; phone_number?: string; avatar_url?: string } | null;
}

function mapOrder(row: RawOrder): ClientOrder {
  return {
    id: row.id,
    status: row.status as OrderStatus,
    issue_description: row.issue_description,
    symptoms: row.symptoms,
    address: row.address,
    contact_phone: row.contact_phone,
    additional_notes: row.additional_notes,
    price_amount: row.price_amount,
    payment_method: row.payment_method,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vehicle_id: row.vehicle_id,
    mechanic_id: row.mechanic_id,
    vehicle_type: row.vehicles?.type ?? null,
    vehicle_brand: row.vehicles?.brand ?? null,
    vehicle_model: row.vehicles?.model ?? null,
    vehicle_year: row.vehicles?.year ?? null,
    vehicle_plate: row.vehicles?.license_plate ?? null,
    vehicle_photo_url: row.vehicles?.photo_url ?? null,
    mechanic_name: row.mechanic?.full_name ?? null,
    mechanic_phone: row.mechanic?.phone_number ?? null,
    mechanic_avatar: row.mechanic?.avatar_url ?? null,
  };
}

export async function getMyId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi berakhir. Silakan login kembali.');
  return user.id;
}

// ---------- Kendaraan ----------

export async function listMyVehicles(): Promise<ClientVehicle[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('vehicles')
    .select(
      'id, owner_id, type, brand, model, year, license_plate, notes, photo_url, created_at',
    )
    .eq('owner_id', id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClientVehicle[];
}

export async function getVehicle(id: string): Promise<ClientVehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(
      'id, owner_id, type, brand, model, year, license_plate, notes, photo_url, created_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientVehicle | null) ?? null;
}

export async function createVehicle(input: VehicleInput): Promise<ClientVehicle> {
  const ownerId = await getMyId();
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ ...input, owner_id: ownerId })
    .select(
      'id, owner_id, type, brand, model, year, license_plate, notes, photo_url, created_at',
    )
    .single();
  if (error) throw error;
  return data as ClientVehicle;
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<void> {
  const { error } = await supabase.from('vehicles').update(input).eq('id', id);
  if (error) throw error;
}

/** Simpan/ganti hanya foto kendaraan (dipakai dari form request cepat). */
export async function updateVehiclePhoto(
  id: string,
  photoUrl: string | null,
): Promise<void> {
  const { error } = await supabase.from('vehicles').update({ photo_url: photoUrl }).eq('id', id);
  if (error) throw error;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from('vehicles').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Pesanan ----------

export async function listMyRequests(limit = 50): Promise<ClientOrder[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('service_requests')
    .select(ORDER_SELECT)
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as RawOrder[]).map(mapOrder);
}

export async function getRequest(id: string): Promise<ClientOrder | null> {
  const { data, error } = await supabase
    .from('service_requests')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data as unknown as RawOrder) : null;
}

export async function createServiceRequest(
  input: CreateServiceRequestInput,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      client_id: input.clientId,
      vehicle_id: input.vehicleId || null,
      issue_description: input.issueDescription.trim(),
      symptoms: input.symptoms?.trim() || null,
      lat: input.lat,
      lng: input.lng,
      address: input.address?.trim() || null,
      contact_phone: input.contactPhone.trim(),
      additional_notes: input.additionalNotes?.trim() || null,
      status: 'requested',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function cancelServiceRequest(id: string): Promise<void> {
  const userId = await getMyId();
  const { data: current, error: readError } = await supabase
    .from('service_requests')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await supabase
    .from('service_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['requested', 'matching']);
  if (error) throw error;

  await supabase.from('service_request_status_history').insert({
    request_id: id,
    from_status: (current as { status?: string } | null)?.status ?? null,
    to_status: 'cancelled',
    changed_by: userId,
    notes: 'Dibatalkan oleh client.',
  });
}

export async function listStatusHistory(requestId: string): Promise<OrderStatusEvent[]> {
  const { data, error } = await supabase
    .from('service_request_status_history')
    .select('id, from_status, to_status, notes, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrderStatusEvent[];
}

// ---------- Montir online ----------

interface RawDirectoryMechanic {
  profile_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  workshop_name?: string | null;
  rating_avg?: number | null;
  total_jobs?: number | null;
  is_online?: boolean | null;
}

function mapMechanic(row: RawDirectoryMechanic): NearbyMechanic {
  return {
    profile_id: row.profile_id,
    full_name: row.full_name ?? null,
    avatar_url: row.avatar_url ?? null,
    workshop_name: row.workshop_name ?? null,
    rating_avg: Number(row.rating_avg ?? 0),
    total_jobs: Number(row.total_jobs ?? 0),
    is_online: Boolean(row.is_online),
  };
}

/**
 * Membaca view `mechanic_directory` (kolom aman: tanpa telepon/koordinat).
 * Jika migration view belum dijalankan, fallback ke mechanic_profiles
 * sehingga Beranda tetap tampil dengan nama generik.
 */
export async function listOnlineMechanics(limit = 10): Promise<NearbyMechanic[]> {
  const { data, error } = await supabase
    .from('mechanic_directory')
    .select(
      'profile_id, full_name, avatar_url, workshop_name, rating_avg, total_jobs, is_online',
    )
    .eq('is_online', true)
    .order('rating_avg', { ascending: false })
    .limit(limit);

  if (!error) {
    return ((data ?? []) as RawDirectoryMechanic[]).map(mapMechanic);
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('mechanic_profiles')
    .select('profile_id, workshop_name, rating_avg, total_jobs, is_online')
    .eq('is_online', true)
    .order('rating_avg', { ascending: false })
    .limit(limit);

  if (fallbackError) throw fallbackError;
  return ((fallback ?? []) as RawDirectoryMechanic[]).map(mapMechanic);
}

// ---------- Notifikasi ----------

export async function getUnreadNotificationCount(): Promise<number> {
  const id = await getMyId();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function listNotifications(limit = 50): Promise<ClientNotification[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, is_read, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ClientNotification[];
}

export async function markNotificationsRead(): Promise<void> {
  const id = await getMyId();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', id)
    .eq('is_read', false);
  if (error) throw error;
}
