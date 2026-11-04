// Data layer section client — langsung ke Supabase; otorisasi dijaga RLS (PRD §6/§22).
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/features/service-request/status';
import type {
  AssignmentDecision,
  ClientNotification,
  ClientOrder,
  ClientReview,
  ClientVehicle,
  CreateServiceRequestInput,
  MechanicAssignmentProfile,
  MechanicLocationSnapshot,
  NearbyMechanic,
  OrderStatusEvent,
  VehicleInput,
} from './types';

export * from './types';

const ORDER_RELATIONS =
  'vehicles ( type, brand, model, year, license_plate, photo_url ), ' +
  'mechanic:profiles!service_requests_mechanic_id_fkey ( full_name, phone_number, avatar_url )';

const ORDER_COLUMNS =
  'id, status, issue_description, symptoms, address, lat, lng, contact_phone, ' +
  'additional_notes, price_amount, payment_method, created_at, updated_at, vehicle_id, ' +
  'mechanic_id, ';

const ORDER_SELECT =
  ORDER_COLUMNS +
  'assignment_requested_at, assignment_expires_at, ' +
  ORDER_RELATIONS;

/** Dipakai bila migrasi konfirmasi montir belum dijalankan di server. */
const ORDER_SELECT_LEGACY = ORDER_COLUMNS + ORDER_RELATIONS;

/**
 * PostgREST menolak kolom yang belum ada setelah migrasi baru dibuat. Deteksi
 * error itu agar aplikasi tetap bisa menampilkan order lama sebelum migrasi
 * konfirmasi montir dijalankan.
 */
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column .* does not exist|could not find the '.*' column/i.test(error.message ?? '')
  );
}

interface RawOrder {
  id: string;
  status: string;
  issue_description: string;
  symptoms: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  contact_phone: string;
  additional_notes: string | null;
  price_amount: number | null;
  payment_method: 'online' | 'cash' | null;
  created_at: string;
  updated_at: string;
  vehicle_id: string | null;
  mechanic_id: string | null;
  assignment_requested_at: string | null;
  assignment_expires_at: string | null;
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
    lat: row.lat,
    lng: row.lng,
    contact_phone: row.contact_phone,
    additional_notes: row.additional_notes,
    price_amount: row.price_amount,
    payment_method: row.payment_method,
    created_at: row.created_at,
    updated_at: row.updated_at,
    vehicle_id: row.vehicle_id,
    mechanic_id: row.mechanic_id,
    assignment_requested_at: row.assignment_requested_at ?? null,
    assignment_expires_at: row.assignment_expires_at ?? null,
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
  const query = (select: string) =>
    supabase
      .from('service_requests')
      .select(select)
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

  let { data, error } = await query(ORDER_SELECT);
  if (isMissingColumnError(error)) {
    ({ data, error } = await query(ORDER_SELECT_LEGACY));
  }
  if (error) throw error;
  return ((data ?? []) as unknown as RawOrder[]).map(mapOrder);
}

export async function getRequest(id: string): Promise<ClientOrder | null> {
  const query = (select: string) =>
    supabase.from('service_requests').select(select).eq('id', id).maybeSingle();

  let { data, error } = await query(ORDER_SELECT);
  if (isMissingColumnError(error)) {
    ({ data, error } = await query(ORDER_SELECT_LEGACY));
  }
  if (error) throw error;
  return data ? mapOrder(data as unknown as RawOrder) : null;
}

/**
 * Posisi montir terakhir untuk satu pesanan.
 *
 * Client hanya boleh membaca baris milik pesanannya (policy `ml_select_involved`),
 * jadi query ini aman dipanggil dari perangkat client. `null` berarti montir
 * belum pernah mengirim sinyal GPS.
 */
export async function getLatestMechanicLocation(
  requestId: string,
): Promise<MechanicLocationSnapshot | null> {
  const { data, error } = await supabase
    .from('mechanic_locations')
    .select('lat, lng, accuracy_meters, recorded_at')
    .eq('request_id', requestId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MechanicLocationSnapshot | null) ?? null;
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
  rating_count?: number | null;
  total_jobs?: number | null;
  is_online?: boolean | null;
  bio?: string | null;
  experience_years?: number | null;
  skills?: string[] | null;
  vehicle_specialization?: string[] | null;
  workshop_photo?: string | null;
}

function mapMechanic(row: RawDirectoryMechanic): NearbyMechanic {
  return {
    profile_id: row.profile_id,
    full_name: row.full_name ?? null,
    avatar_url: row.avatar_url ?? null,
    workshop_name: row.workshop_name ?? null,
    rating_avg: Number(row.rating_avg ?? 0),
    rating_count: Number(row.rating_count ?? 0),
    total_jobs: Number(row.total_jobs ?? 0),
    is_online: Boolean(row.is_online),
    bio: row.bio ?? null,
    experience_years: row.experience_years ?? null,
    skills: row.skills ?? [],
    vehicle_specialization: row.vehicle_specialization ?? [],
    workshop_photo: row.workshop_photo ?? null,
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
      'profile_id, full_name, avatar_url, workshop_name, rating_avg, rating_count, total_jobs, is_online, bio, experience_years, skills, vehicle_specialization, workshop_photo',
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
    .select(
      'id, title, body, type, is_read, created_at, related_entity_type, related_entity_id',
    )
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

// ---------- Ulasan montir ----------

/** Ulasan yang sudah dikirim client untuk satu pesanan (null bila belum). */
export async function getReviewForRequest(requestId: string): Promise<ClientReview | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, mechanic_id, rating, comment, mechanic_reply, replied_at, created_at')
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw error;
  return (data as ClientReview | null) ?? null;
}

/** Ulasan publik seorang montir (nama reviewer sudah disamarkan oleh view). */
export async function listMechanicReviews(
  mechanicId: string,
  limit = 20,
): Promise<ClientReview[]> {
  const { data, error } = await supabase
    .from('mechanic_review_view')
    .select('id, mechanic_id, rating, comment, mechanic_reply, replied_at, created_at, reviewer_name')
    .eq('mechanic_id', mechanicId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ClientReview[];
}

/**
 * Profil montir yang sedang mengajukan diri ke salah satu order client.
 * View `mechanic_assignment_profile` hanya mengembalikan montir yang punya
 * relasi order dengan client pemanggil, jadi aman dipakai sebelum order lunas.
 */
export async function getMechanicAssignmentProfile(
  mechanicId: string,
): Promise<MechanicAssignmentProfile | null> {
  const { data, error } = await supabase
    .from('mechanic_assignment_profile')
    .select(
      'profile_id, full_name, avatar_url, workshop_name, workshop_address, bio, ' +
        'experience_years, skills, vehicle_specialization, certifications, workshop_photo, ' +
        'rating_avg, rating_count, total_jobs, is_verified, verified_at',
    )
    .eq('profile_id', mechanicId)
    .maybeSingle();
  if (error) throw error;
  return (data as MechanicAssignmentProfile | null) ?? null;
}

const ASSIGNMENT_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sesi berakhir. Silakan login kembali.',
};

/**
 * Client menjawab pengajuan montir.
 * `accept` mengubah order menjadi `mechanic_accepted`; `reject` mengembalikan
 * order ke kolam; `reject_and_cancel` membatalkan order sekaligus.
 */
export async function respondToAssignment(
  requestId: string,
  decision: AssignmentDecision,
): Promise<void> {
  const { error } = await supabase.rpc('respond_to_assignment', {
    p_request_id: requestId,
    p_action: decision,
  });
  if (!error) return;

  const message = (error.message ?? '').trim();
  if (error.code === '42883' || /could not find the function|does not exist/i.test(message)) {
    throw new Error(
      'Fitur konfirmasi montir belum aktif di server. Jalankan migrasi database lalu coba lagi.',
    );
  }
  throw new Error(
    ASSIGNMENT_ERROR_MESSAGES[message] ?? (message || 'Gagal mengonfirmasi montir.'),
  );
}

/**
 * Client memberi rating untuk order yang sudah lunas.
 * RLS memastikan hanya order milik client dengan status `paid` yang bisa diulas.
 */
export async function submitReview(input: {
  requestId: string;
  rating: number;
  comment?: string | null;
}): Promise<void> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error('Pilih rating 1 sampai 5 bintang.');
  }

  const clientId = await getMyId();
  const { data: request, error: requestError } = await supabase
    .from('service_requests')
    .select('id, mechanic_id, status')
    .eq('id', input.requestId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request) throw new Error('Pesanan tidak ditemukan.');
  if (request.status !== 'paid') {
    throw new Error('Ulasan bisa dikirim setelah pembayaran pesanan lunas.');
  }
  if (!request.mechanic_id) {
    throw new Error('Pesanan ini belum memiliki montir.');
  }

  const { error } = await supabase.from('reviews').insert({
    request_id: input.requestId,
    client_id: clientId,
    mechanic_id: request.mechanic_id,
    rating: Math.round(input.rating),
    comment: input.comment?.trim() || null,
  });
  if (error) {
    if (error.code === '23505') {
      throw new Error('Ulasan untuk pesanan ini sudah pernah dikirim.');
    }
    throw error;
  }
}
