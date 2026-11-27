// Data layer section client — langsung ke Supabase; otorisasi dijaga RLS (PRD §6/§22).
import { getCurrentUserId } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/features/service-request/status';
import { getCsWhatsAppNumber } from '@/utils/whatsapp';
import type {
  AssignedOrderMechanic,
  AssignmentDecision,
  CalloutFeeTier,
  ClientNotification,
  ClientOrder,
  ClientReview,
  ClientVehicle,
  CreateServiceRequestInput,
  InvoiceItemType,
  MechanicAssignmentProfile,
  MechanicLocationSnapshot,
  NearbyMechanic,
  OrderInvoiceItem,
  OrderStatusEvent,
  PlatformPricingAndSupport,
  QuoteStatus,
  VehicleInput,
} from './types';

export * from './types';

const ORDER_RELATIONS =
  'vehicles ( type, brand, model, year, license_plate, photo_url ), ' +
  'mechanic:profiles!service_requests_mechanic_id_fkey ( full_name, phone_number, avatar_url )';

const ORDER_SELECT =
  'id, status, issue_description, symptoms, address, lat, lng, contact_phone, ' +
  'additional_notes, price_amount, payment_method, created_at, updated_at, vehicle_id, ' +
  'mechanic_id, assignment_requested_at, assignment_expires_at, ' +
  'route_polyline, route_distance_m, route_duration_s, route_updated_at, ' +
  'callout_fee_tier, callout_fee_amount, quote_status, quote_submitted_at, ' +
  'quote_approved_at, quote_expires_at, quote_revision_note, quote_photo_paths, ' +
  'rejected_quote_snapshot, ' +
  ORDER_RELATIONS;

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
  route_polyline: string | null;
  route_distance_m: number | null;
  route_duration_s: number | null;
  route_updated_at: string | null;
  callout_fee_tier: string | null;
  callout_fee_amount: number | null;
  quote_status: string | null;
  quote_submitted_at: string | null;
  quote_approved_at: string | null;
  quote_expires_at: string | null;
  quote_revision_note: string | null;
  quote_photo_paths: string[] | null;
  rejected_quote_snapshot: unknown | null;
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

function normalizeCalloutTier(value: string | null | undefined): CalloutFeeTier {
  if (value === 'mobil' || value === 'derek') return value;
  return 'motor';
}

function normalizeQuoteStatus(value: string | null | undefined): QuoteStatus {
  if (
    value === 'pending_approval' ||
    value === 'approved' ||
    value === 'callout_only'
  ) {
    return value;
  }
  return 'draft';
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
    route_polyline: row.route_polyline ?? null,
    route_distance_m: row.route_distance_m ?? null,
    route_duration_s: row.route_duration_s ?? null,
    route_updated_at: row.route_updated_at ?? null,
    callout_fee_tier: normalizeCalloutTier(row.callout_fee_tier),
    callout_fee_amount: Number(row.callout_fee_amount ?? 0),
    quote_status: normalizeQuoteStatus(row.quote_status),
    quote_submitted_at: row.quote_submitted_at ?? null,
    quote_approved_at: row.quote_approved_at ?? null,
    quote_expires_at: row.quote_expires_at ?? null,
    quote_revision_note: row.quote_revision_note ?? null,
    quote_photo_paths: Array.isArray(row.quote_photo_paths) ? row.quote_photo_paths : [],
    rejected_quote_snapshot: row.rejected_quote_snapshot ?? null,
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
  // Sesi lokal saja — tidak memanggil /auth/v1/user di setiap query.
  return getCurrentUserId();
}

// ---------- Ringkasan profil client ----------

export interface ClientProfileSummary {
  avatar_url: string | null;
  joined_at: string | null;
  total_requests: number;
  total_vehicles: number;
}

/**
 * Data ringkas untuk layar profil client. Hitungan memakai `head: true`
 * supaya Supabase tidak mengirim baris yang tidak dibutuhkan.
 */
export async function getMyClientSummary(): Promise<ClientProfileSummary> {
  const id = await getMyId();
  const [profile, requests, vehicles] = await Promise.all([
    supabase.from('profiles').select('avatar_url, created_at').eq('id', id).maybeSingle(),
    supabase
      .from('service_requests')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', id),
    supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('owner_id', id),
  ]);

  const row = profile.data as { avatar_url?: string | null; created_at?: string | null } | null;
  return {
    avatar_url: row?.avatar_url ?? null,
    joined_at: row?.created_at ?? null,
    total_requests: requests.count ?? 0,
    total_vehicles: vehicles.count ?? 0,
  };
}

// ---------- Tarif biaya panggil & dukungan CS ----------

export const DEFAULT_PLATFORM_PRICING: PlatformPricingAndSupport = {
  callout_fee_motor: 25_000,
  callout_fee_mobil: 45_000,
  callout_fee_derek: 100_000,
  quote_expire_minutes: 15,
  cs_whatsapp_number: getCsWhatsAppNumber(null),
};

export async function getPlatformPricingAndSupport(): Promise<PlatformPricingAndSupport> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select(
      'callout_fee_motor, callout_fee_mobil, callout_fee_derek, quote_expire_minutes, cs_whatsapp_number',
    )
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_PLATFORM_PRICING;
  }

  return {
    callout_fee_motor: Number(data.callout_fee_motor ?? DEFAULT_PLATFORM_PRICING.callout_fee_motor),
    callout_fee_mobil: Number(data.callout_fee_mobil ?? DEFAULT_PLATFORM_PRICING.callout_fee_mobil),
    callout_fee_derek: Number(data.callout_fee_derek ?? DEFAULT_PLATFORM_PRICING.callout_fee_derek),
    quote_expire_minutes: Number(
      data.quote_expire_minutes ?? DEFAULT_PLATFORM_PRICING.quote_expire_minutes,
    ),
    cs_whatsapp_number: getCsWhatsAppNumber(data.cs_whatsapp_number),
  };
}

export function getCalloutFeeAmountForTier(
  pricing: PlatformPricingAndSupport,
  tier: CalloutFeeTier,
): number {
  if (tier === 'derek') return pricing.callout_fee_derek;
  if (tier === 'mobil') return pricing.callout_fee_mobil;
  return pricing.callout_fee_motor;
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

const CREATE_REQUEST_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'Sesi berakhir. Silakan login kembali.',
  FORBIDDEN: 'Hanya akun client yang dapat membuat permintaan layanan.',
  ACTIVE_ORDER_EXISTS: 'Kamu masih memiliki pesanan aktif. Selesaikan atau batalkan sebelum membuat yang baru.',
  INVALID_ISSUE_DESCRIPTION: 'Jelaskan keluhan kendaraan minimal 5 karakter.',
  INVALID_CONTACT_PHONE: 'Nomor WhatsApp wajib diisi dengan benar.',
  INVALID_COORDINATES: 'Koordinat lokasi tidak valid.',
  INVALID_VEHICLE: 'Kendaraan yang dipilih tidak valid.',
  INVALID_CALLOUT_TIER: 'Pilih kategori biaya panggil (Motor, Mobil, atau Derek).',
};

export async function createServiceRequest(
  input: CreateServiceRequestInput,
): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('create_service_request', {
    p_vehicle_id: input.vehicleId || undefined,
    p_issue_description: input.issueDescription.trim(),
    p_symptoms: input.symptoms?.trim() || undefined,
    p_lat: input.lat,
    p_lng: input.lng,
    p_address: input.address?.trim() || undefined,
    p_contact_phone: input.contactPhone.trim(),
    p_additional_notes: input.additionalNotes?.trim() || undefined,
    p_callout_fee_tier: input.calloutFeeTier ?? undefined,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    throw new Error(CREATE_REQUEST_ERRORS[code] ?? (code || 'Gagal membuat permintaan layanan.'));
  }
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
  if (!row?.id) throw new Error('Permintaan gagal dibuat.');
  return { id: row.id };
}

export async function cancelServiceRequest(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_order', {
    p_request_id: id,
    p_reason: reason?.trim() || undefined,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    if (code.includes('CANNOT_CANCEL_AT_STAGE')) {
      throw new Error('Pesanan tidak dapat dibatalkan setelah montir tiba di lokasi.');
    }
    throw new Error(code || 'Gagal membatalkan pesanan.');
  }
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

/**
 * Rincian baris tagihan (deskripsi, nominal, tipe, kunci) yang dikirim montir.
 * Secara default hanya mengembalikan baris aktif (`voided_at is null`).
 */
export async function listOrderInvoiceItems(
  requestId: string,
  options?: { includeVoided?: boolean },
): Promise<OrderInvoiceItem[]> {
  let query = supabase
    .from('order_invoice_items')
    .select(
      'id, request_id, mechanic_id, description, amount, item_type, is_locked, approved_at, voided_at, quote_photo_paths, created_at, updated_at',
    )
    .eq('request_id', requestId);

  if (!options?.includeVoided) {
    query = query.is('voided_at', null);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;

  const items = ((data ?? []) as Partial<OrderInvoiceItem>[]).map((row) => ({
    id: row.id ?? '',
    request_id: row.request_id ?? requestId,
    mechanic_id: row.mechanic_id,
    description: row.description ?? '',
    amount: Number(row.amount ?? 0),
    item_type: (row.item_type as InvoiceItemType) || 'service',
    is_locked: Boolean(row.is_locked),
    approved_at: row.approved_at ?? null,
    voided_at: row.voided_at ?? null,
    quote_photo_paths: Array.isArray(row.quote_photo_paths) ? row.quote_photo_paths : [],
    created_at: row.created_at ?? '',
    updated_at: row.updated_at,
  }));

  return items.sort((a, b) => {
    if (a.item_type === 'callout_fee' && b.item_type !== 'callout_fee') return -1;
    if (a.item_type !== 'callout_fee' && b.item_type === 'callout_fee') return 1;
    return a.created_at.localeCompare(b.created_at);
  });
}

const QUOTE_RESPONSE_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'Sesi berakhir. Silakan login kembali.',
  FORBIDDEN: 'Hanya client pemilik pesanan yang dapat menanggapi estimasi.',
  ORDER_NOT_ARRIVED: 'Estimasi hanya bisa ditanggapi saat montir berstatus tiba di lokasi.',
  QUOTE_NOT_PENDING: 'Estimasi belum dikirim atau statusnya sudah berubah.',
  REVISION_NOTE_REQUIRED: 'Tulis alasan / catatan revisi sebelum meminta perbaikan estimasi.',
};

export async function respondToQuote(
  requestId: string,
  action: 'approve' | 'request_revision' | 'callout_only',
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('respond_to_quote', {
    p_request_id: requestId,
    p_action: action,
    p_note: note?.trim() || undefined,
  });
  if (!error) return;
  const code = (error.message ?? '').trim();
  throw new Error(
    QUOTE_RESPONSE_ERRORS[code] ?? (code || 'Gagal menyimpan keputusan estimasi.'),
  );
}

// ---------- Montir online & pasca-penugasan ----------

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
  distance_km?: number | null;
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
    distance_km: row.distance_km == null ? null : Number(row.distance_km),
  };
}

/**
 * Membaca daftar montir online terverifikasi lewat RPC `list_nearby_mechanics`.
 * Tidak pernah menyentuh tabel `mechanic_profiles` langsung atau mengekspos koordinat.
 */
export async function listOnlineMechanics(
  limit = 10,
  coords?: { lat: number; lng: number; radiusKm?: number } | null,
): Promise<NearbyMechanic[]> {
  const { data, error } = await supabase.rpc('list_nearby_mechanics', {
    p_lat: coords?.lat ?? undefined,
    p_lng: coords?.lng ?? undefined,
    p_radius_km: coords?.radiusKm ?? 15,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as RawDirectoryMechanic[]).map(mapMechanic);
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

// ---------- Ulasan & Profil Montir ----------

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
        'vehicle_label, vehicle_plate, rating_avg, rating_count, total_jobs, is_verified, verified_at',
    )
    .eq('profile_id', mechanicId)
    .maybeSingle();
  if (error) throw error;
  return (data as MechanicAssignmentProfile | null) ?? null;
}

/** Info kendaraan & profil montir terassigned via `assigned_order_mechanic_view` (pasca-penugasan). */
export async function getAssignedOrderMechanic(
  requestId: string,
): Promise<AssignedOrderMechanic | null> {
  const { data, error } = await supabase
    .from('assigned_order_mechanic_view')
    .select(
      'request_id, mechanic_id, full_name, avatar_url, phone_number, workshop_name, ' +
        'workshop_address, vehicle_label, vehicle_plate, rating_avg, rating_count, total_jobs, is_verified',
    )
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) throw error;
  return (data as AssignedOrderMechanic | null) ?? null;
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
