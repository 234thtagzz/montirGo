// Data layer section montir — langsung ke Supabase (RLS menjaga otorisasi, PRD §6/§22).
import { getCurrentUserId } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';
import {
  mapAiAnalysis,
  type RawAiAnalysis,
} from '@/features/service-request/ai';
import type {
  ActivityItem,
  CalloutFeeTier,
  EarningsSummary,
  IncomingOrder,
  IncomingRequestDetail,
  MechanicLocationPoint,
  MechanicOrderDetail,
  MechanicProfile,
  MechanicProfilePatch,
  MechanicReview,
  MyOrder,
  OrderInvoiceItem,
  OrderStatus,
  OrderStatusEvent,
  QuoteStatus,
  RejectedQuoteSnapshot,
} from './types';

export * from './types';

const ACTIVE_STATUSES = [
  'mechanic_assigned',
  'mechanic_accepted',
  'on_the_way',
  'arrived',
  'payment',
];

export async function getMyId(): Promise<string> {
  // Sesi lokal saja — tidak memanggil /auth/v1/user di setiap query.
  return getCurrentUserId();
}

export async function getMechanicProfile(): Promise<MechanicProfile | null> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('mechanic_profiles')
    .select('*')
    .eq('profile_id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as MechanicProfile | null) ?? null;
}

export async function setOnlineStatus(
  isOnline: boolean,
  coords?: { lat: number; lng: number } | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_mechanic_online_status', {
    p_is_online: isOnline,
    p_lat: coords?.lat ?? null,
    p_lng: coords?.lng ?? null,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    if (code.includes('MECHANIC_NOT_VERIFIED')) {
      throw new Error('Akun montirmu belum diverifikasi admin. Hubungi admin untuk verifikasi.');
    }
    throw new Error(code || 'Tidak bisa mengubah status online.');
  }
}

export async function updateMechanicProfile(patch: MechanicProfilePatch): Promise<void> {
  const id = await getMyId();
  const { error } = await supabase
    .from('mechanic_profiles')
    .upsert({ profile_id: id, ...patch }, { onConflict: 'profile_id' });
  if (error) throw error;
}

// ---------- Data identitas (tabel profiles) ----------

export interface MyProfileRow {
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
}

export async function getMyProfileRow(): Promise<MyProfileRow> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone_number, avatar_url')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (
    (data as MyProfileRow | null) ?? {
      full_name: null,
      phone_number: null,
      avatar_url: null,
    }
  );
}

export async function updateMyProfileIdentity(patch: {
  full_name?: string | null;
  phone_number?: string | null;
  avatar_url?: string | null;
}): Promise<void> {
  const id = await getMyId();
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) throw error;
}

// ---------- Ulasan & rating ----------

/** Ulasan publik milik montir. Bisa dipanggil tanpa parameter untuk diri sendiri. */
export async function listMechanicReviews(
  mechanicId?: string,
  limit = 20,
): Promise<MechanicReview[]> {
  const id = mechanicId ?? (await getMyId());
  const { data, error } = await supabase
    .from('mechanic_review_view')
    .select('id, mechanic_id, rating, comment, mechanic_reply, replied_at, created_at, reviewer_name')
    .eq('mechanic_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MechanicReview[];
}

// Order terbuka yang bisa diambil (khusus montir terverifikasi, tanpa PII kontak/koordinat presisi).
export async function listIncomingOrders(
  coords?: { lat: number; lng: number; radiusKm?: number } | null,
): Promise<IncomingOrder[]> {
  const { data, error } = await supabase.rpc('list_nearby_open_requests', {
    p_lat: coords?.lat ?? null,
    p_lng: coords?.lng ?? null,
    p_radius_km: coords?.radiusKm ?? null,
    p_limit: 30,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    if (code.includes('MECHANIC_NOT_VERIFIED')) {
      throw new Error('Akun montirmu belum diverifikasi admin untuk melihat request masuk.');
    }
    throw error;
  }

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const analysis = mapAiAnalysis(r.ai_analysis as RawAiAnalysis | null);
    return {
      id: r.id as string,
      issue_description: r.issue_description as string,
      symptoms: (r.symptoms as string | null) ?? null,
      address_area: (r.address_area as string | null) ?? null,
      distance_km: r.distance_km == null ? null : Number(r.distance_km),
      status: r.status as OrderStatus,
      created_at: r.created_at as string,
      vehicle_type: (r.vehicle_type as string | null) ?? null,
      vehicle_brand: (r.vehicle_brand as string | null) ?? null,
      vehicle_model: (r.vehicle_model as string | null) ?? null,
      client_name: (r.client_name as string | null) ?? null,
      client_avatar_url: (r.client_avatar_url as string | null) ?? null,
      ai_risk_level: analysis?.riskLevel ?? null,
      has_analysis: analysis !== null,
    };
  });
}

/**
 * Detail request terbuka untuk layar otorisasi montir (sebelum menerima).
 * Mengembalikan null bila request sudah diambil montir lain, ditolak, atau dibatalkan.
 * Tidak mengekspos no WA, plat nomor, atau koordinat presisi sebelum disetujui client.
 */
export async function getIncomingRequestDetail(
  id: string,
): Promise<IncomingRequestDetail | null> {
  const { data, error } = await supabase
    .from('mechanic_open_request_view')
    .select(
      'id, status, issue_description, symptoms, address_area, distance_km, ' +
        'additional_notes, created_at, client_name, client_avatar_url, client_joined_at, ' +
        'client_total_requests, vehicle_type, vehicle_brand, vehicle_model, vehicle_year, ' +
        'vehicle_photo_url, ai_analysis, ai_created_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapIncomingDetail(data as unknown as Record<string, unknown>);
}

function mapIncomingDetail(r: Record<string, unknown>): IncomingRequestDetail {
  return {
    id: r.id as string,
    status: r.status as OrderStatus,
    issue_description: r.issue_description as string,
    symptoms: (r.symptoms as string | null) ?? null,
    address_area: (r.address_area as string | null) ?? null,
    distance_km: r.distance_km == null ? null : Number(r.distance_km),
    additional_notes: (r.additional_notes as string | null) ?? null,
    created_at: r.created_at as string,
    client_name: (r.client_name as string | null) ?? null,
    client_avatar_url: (r.client_avatar_url as string | null) ?? null,
    client_joined_at: (r.client_joined_at as string | null) ?? null,
    client_total_requests:
      r.client_total_requests == null ? null : Number(r.client_total_requests),
    vehicle_type: (r.vehicle_type as string | null) ?? null,
    vehicle_brand: (r.vehicle_brand as string | null) ?? null,
    vehicle_model: (r.vehicle_model as string | null) ?? null,
    vehicle_year: (r.vehicle_year as number | null) ?? null,
    vehicle_photo_url: (r.vehicle_photo_url as string | null) ?? null,
    ai_analysis: mapAiAnalysis(r.ai_analysis as RawAiAnalysis | null),
    ai_created_at: (r.ai_created_at as string | null) ?? null,
  };
}

export async function listMyOrders(onlyActive = false): Promise<MyOrder[]> {
  const id = await getMyId();
  let q = supabase
    .from('service_requests')
    .select(
      'id, issue_description, symptoms, address, contact_phone, status, price_amount, created_at, ' +
        'callout_fee_tier, callout_fee_amount, quote_status, assignment_expires_at, ' +
        'vehicles (type, brand, model), ' +
        'client:profiles!service_requests_client_id_fkey (full_name, phone_number)',
    )
    .eq('mechanic_id', id);
  if (onlyActive) q = q.in('status', ACTIVE_STATUSES);

  const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    issue_description: r.issue_description as string,
    symptoms: r.symptoms as string | null,
    address: r.address as string | null,
    contact_phone: r.contact_phone as string,
    status: r.status as OrderStatus,
    price_amount: r.price_amount as number | null,
    created_at: r.created_at as string,
    vehicle_type: (r.vehicles as { type?: string } | null)?.type ?? null,
    vehicle_brand: (r.vehicles as { brand?: string } | null)?.brand ?? null,
    vehicle_model: (r.vehicles as { model?: string } | null)?.model ?? null,
    client_name: (r.client as { full_name?: string } | null)?.full_name ?? null,
    client_phone: (r.client as { phone_number?: string } | null)?.phone_number ?? null,
    callout_fee_tier: ((r.callout_fee_tier as CalloutFeeTier | null) ?? 'motor'),
    callout_fee_amount: r.callout_fee_amount == null ? null : Number(r.callout_fee_amount),
    quote_status: ((r.quote_status as QuoteStatus | null) ?? 'draft'),
    assignment_expires_at: (r.assignment_expires_at as string | null) ?? null,
  }));
}

export async function getMyActiveOrderId(mechanicId?: string): Promise<string | null> {
  const id = mechanicId ?? (await getMyId());
  const { data, error } = await supabase
    .from('service_requests')
    .select('id')
    .eq('mechanic_id', id)
    .neq('status', 'paid')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

export async function getMyOrder(id: string): Promise<MechanicOrderDetail | null> {
  const mechanicId = await getMyId();
  const { data, error } = await supabase
    .from('service_requests')
    .select(
      'id, issue_description, symptoms, address, lat, lng, contact_phone, additional_notes, status, ' +
        'price_amount, payment_method, created_at, updated_at, accepted_at, arrived_at, ' +
        'assignment_requested_at, assignment_expires_at, ' +
        'callout_fee_tier, callout_fee_amount, quote_status, quote_submitted_at, quote_expires_at, ' +
        'quote_approved_at, quote_revision_note, quote_photo_paths, rejected_quote_snapshot, ' +
        'vehicles (type, brand, model, year, license_plate, photo_url), ' +
        'client:profiles!service_requests_client_id_fkey (full_name, phone_number)',
    )
    .eq('id', id)
    .eq('mechanic_id', mechanicId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  return {
    id: r.id as string,
    issue_description: r.issue_description as string,
    symptoms: r.symptoms as string | null,
    address: r.address as string | null,
    contact_phone: r.contact_phone as string,
    additional_notes: (r.additional_notes as string | null) ?? null,
    status: r.status as OrderStatus,
    price_amount: r.price_amount as number | null,
    payment_method: (r.payment_method as 'online' | 'cash' | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    lat: Number(r.lat),
    lng: Number(r.lng),
    accepted_at: (r.accepted_at as string | null) ?? null,
    arrived_at: (r.arrived_at as string | null) ?? null,
    assignment_requested_at: (r.assignment_requested_at as string | null) ?? null,
    assignment_expires_at: (r.assignment_expires_at as string | null) ?? null,
    callout_fee_tier: ((r.callout_fee_tier as CalloutFeeTier | null) ?? 'motor'),
    callout_fee_amount: r.callout_fee_amount == null ? null : Number(r.callout_fee_amount),
    quote_status: ((r.quote_status as QuoteStatus | null) ?? 'draft'),
    quote_submitted_at: (r.quote_submitted_at as string | null) ?? null,
    quote_expires_at: (r.quote_expires_at as string | null) ?? null,
    quote_approved_at: (r.quote_approved_at as string | null) ?? null,
    quote_revision_note: (r.quote_revision_note as string | null) ?? null,
    quote_photo_paths: Array.isArray(r.quote_photo_paths)
      ? (r.quote_photo_paths as string[])
      : [],
    rejected_quote_snapshot:
      (r.rejected_quote_snapshot as RejectedQuoteSnapshot | null) ?? null,
    vehicle_type: (r.vehicles as { type?: string } | null)?.type ?? null,
    vehicle_brand: (r.vehicles as { brand?: string } | null)?.brand ?? null,
    vehicle_model: (r.vehicles as { model?: string } | null)?.model ?? null,
    vehicle_year: (r.vehicles as { year?: number | null } | null)?.year ?? null,
    vehicle_plate: (r.vehicles as { license_plate?: string } | null)?.license_plate ?? null,
    vehicle_photo_url: (r.vehicles as { photo_url?: string | null } | null)?.photo_url ?? null,
    client_name: (r.client as { full_name?: string } | null)?.full_name ?? null,
    client_phone: (r.client as { phone_number?: string } | null)?.phone_number ?? null,
  };
}

/**
 * Menyimpan satu titik posisi montir selama perjalanan.
 *
 * RPC server memvalidasi bahwa pemanggil benar-benar montir order tersebut dan
 * order masih dalam perjalanan, lalu memperbarui `mechanic_locations` +
 * `mechanic_profiles.current_lat/current_lng` dalam satu transaksi.
 */
export async function recordMechanicLocation(
  requestId: string,
  input: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    route?: {
      polyline: string;
      distanceMeters: number;
      durationSeconds: number;
    } | null;
  },
): Promise<void> {
  const { error } = await supabase.rpc('record_mechanic_location', {
    p_request_id: requestId,
    p_lat: input.lat,
    p_lng: input.lng,
    p_accuracy: input.accuracy ?? null,
    p_route_polyline: input.route?.polyline ?? null,
    p_route_distance_m:
      input.route != null ? Math.round(input.route.distanceMeters) : null,
    p_route_duration_s:
      input.route != null ? Math.round(input.route.durationSeconds) : null,
  });
  if (error) throw new Error(mapTripError(error.message));
}

const TRIP_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sesi berakhir. Silakan login kembali.',
  NOT_ACTIVE_TRIP: 'Order ini tidak sedang dalam perjalanan.',
  INVALID_COORDINATES: 'Koordinat lokasi tidak valid.',
};

function mapTripError(message: string | null | undefined): string {
  const code = (message ?? '').trim();
  return TRIP_ERROR_MESSAGES[code] ?? code ?? 'Gagal menyimpan lokasi perjalanan.';
}

/** Titik terakhir yang sempat terkirim — dipakai untuk resume saat app dibuka ulang. */
export async function getLastMechanicLocation(
  requestId: string,
): Promise<MechanicLocationPoint | null> {
  const { data, error } = await supabase
    .from('mechanic_locations')
    .select('lat, lng, accuracy_meters, recorded_at')
    .eq('request_id', requestId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MechanicLocationPoint | null) ?? null;
}

export async function listOrderStatusHistory(requestId: string): Promise<OrderStatusEvent[]> {
  const { data, error } = await supabase
    .from('service_request_status_history')
    .select('id, from_status, to_status, notes, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrderStatusEvent[];
}

const ACCEPT_RPC = 'accept_service_request';

/** Pesan seragam saat montir masih memegang order yang belum selesai. */
export const ACTIVE_ORDER_MESSAGE =
  'Kamu masih punya order aktif. Selesaikan order itu sampai lunas sebelum mengambil request baru.';

/**
 * Mengajukan pengambilan request secara atomik via RPC `accept_service_request`.
 */
export async function acceptOrder(requestId: string): Promise<void> {
  const id = await getMyId();
  const activeOrderId = await getMyActiveOrderId(id).catch(() => null);
  if (activeOrderId) throw new Error(ACTIVE_ORDER_MESSAGE);

  const { data, error } = await supabase.rpc(ACCEPT_RPC, { p_request_id: requestId });
  if (error) {
    const code = (error.message ?? '').trim();
    if (code.includes('MECHANIC_NOT_VERIFIED')) {
      throw new Error('Akun montirmu belum diverifikasi admin.');
    }
    if (code.includes('COMMISSION_DEBT_LIMIT_EXCEEDED')) {
      throw new Error(
        'Tunggakan komisi order tunai melebihi batas. Selesaikan order online atau hubungi admin.',
      );
    }
    throw new Error(code || 'Request sudah diambil montir lain atau tidak tersedia.');
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id?: string; mechanic_id?: string | null }
    | null;
  if (!row?.id || row.mechanic_id !== id) {
    throw new Error('Request sudah diambil montir lain atau sudah tidak tersedia.');
  }
}

export async function updateOrderStatus(requestId: string, toStatus: OrderStatus): Promise<void> {
  if (toStatus !== 'on_the_way' && toStatus !== 'arrived') {
    throw new Error('Transisi status ini tidak diizinkan dari layar ini.');
  }
  const { error } = await supabase.rpc('transition_order_status', {
    p_request_id: requestId,
    p_to_status: toStatus,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    if (code.includes('INVALID_TRANSITION')) {
      throw new Error('Status order sudah berubah. Muat ulang halaman.');
    }
    throw new Error(code || 'Status order gagal diubah.');
  }
}

/** Status order yang boleh dibatalkan montir (`mechanic_accepted`/`on_the_way` kembali ke kolam, `arrived` menjadi `cancelled`). */
const MECHANIC_CANCELLABLE_STATUSES = [
  'mechanic_accepted',
  'on_the_way',
  'arrived',
] as const;

export function canMechanicCancel(status: string): boolean {
  return (MECHANIC_CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Montir membatalkan order aktif via RPC atomik `cancel_order`.
 * Sebelum `arrived`, order dikembalikan ke kolam (`requested`) agar client tetap terbantu.
 */
export async function cancelOrderAsMechanic(
  requestId: string,
  reason?: string,
): Promise<{ returnedToPool: boolean }> {
  const { data, error } = await supabase.rpc('cancel_order', {
    p_request_id: requestId,
    p_reason: reason?.trim() || null,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    if (code.includes('CANCEL_REASON_REQUIRED')) {
      throw new Error('Pilih atau tulis alasan pembatalan setelah tiba di lokasi.');
    }
    if (code.includes('QUOTE_APPROVAL_PENDING')) {
      throw new Error(
        'Client masih meninjau estimasi. Kamu bisa membatalkan setelah batas waktu respons habis atau tarik estimasi dulu.',
      );
    }
    if (code.includes('CANNOT_CANCEL_AT_STAGE')) {
      throw new Error('Order pada tahap ini sudah tidak dapat dibatalkan.');
    }
    throw new Error(code || 'Pesanan gagal dibatalkan.');
  }
  const row = (Array.isArray(data) ? data[0] : data) as { status?: string } | null;
  return { returnedToPool: row?.status === 'requested' };
}

// ---------- Tagihan terperinci & Digital Approval ----------

const INVOICE_ITEM_SELECT =
  'id, request_id, mechanic_id, description, amount, item_type, is_locked, approved_at, voided_at, quote_photo_paths, created_at, updated_at';

/** Semua baris tagihan milik satu order, urut sesuai urutan dibuat. */
export async function listOrderInvoiceItems(
  requestId: string,
  options?: { includeVoided?: boolean },
): Promise<OrderInvoiceItem[]> {
  let query = supabase
    .from('order_invoice_items')
    .select(INVOICE_ITEM_SELECT)
    .eq('request_id', requestId);

  if (!options?.includeVoided) {
    query = query.is('voided_at', null);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    request_id: row.request_id as string,
    mechanic_id: row.mechanic_id as string | undefined,
    description: row.description as string,
    amount: Number(row.amount),
    item_type: (row.item_type as OrderInvoiceItem['item_type']) ?? 'service',
    is_locked: Boolean(row.is_locked),
    approved_at: (row.approved_at as string | null) ?? null,
    voided_at: (row.voided_at as string | null) ?? null,
    quote_photo_paths: Array.isArray(row.quote_photo_paths)
      ? (row.quote_photo_paths as string[])
      : [],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string | undefined,
  }));
}

/** Montir menambah satu baris jasa atau suku cadang pada draf estimasi. */
export async function addOrderInvoiceItem(
  requestId: string,
  input: { description: string; amount: number; itemType?: 'service' | 'parts' },
): Promise<OrderInvoiceItem> {
  const mechanicId = await getMyId();
  const description = input.description.trim();
  if (!description) throw new Error('Keterangan wajib diisi.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Harga harus lebih dari 0.');
  }

  const { data, error } = await supabase
    .from('order_invoice_items')
    .insert({
      request_id: requestId,
      mechanic_id: mechanicId,
      description,
      amount: Math.round(input.amount),
      item_type: input.itemType ?? 'service',
    })
    .select(INVOICE_ITEM_SELECT)
    .single();
  if (error) throw error;
  return {
    ...(data as unknown as OrderInvoiceItem),
    amount: Number((data as { amount: number }).amount),
    quote_photo_paths: Array.isArray((data as { quote_photo_paths?: unknown }).quote_photo_paths)
      ? ((data as { quote_photo_paths: string[] }).quote_photo_paths)
      : [],
  };
}

/** Hapus satu baris selama tagihan belum disetujui/dikunci. */
export async function deleteOrderInvoiceItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('order_invoice_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

const INVOICE_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sesi berakhir. Silakan login kembali.',
  REQUEST_NOT_FOUND: 'Order tidak ditemukan.',
  NOT_YOUR_ORDER: 'Order ini bukan milikmu.',
  INVALID_STATUS: 'Aksi ini hanya tersedia setelah kamu tiba di lokasi client.',
  INVALID_QUOTE_STATUS: 'Status estimasi sudah berubah. Muat ulang halaman.',
  QUOTE_NOT_APPROVED: 'Client belum menyetujui estimasi biaya. Kirim estimasi terlebih dahulu.',
  CALLOUT_ONLY_LOCKED: 'Order biaya panggil saja terkunci dan tidak dapat dibuka ulang.',
  TOO_MANY_QUOTE_PHOTOS: 'Maksimal 3 foto bukti kerusakan.',
  INVALID_QUOTE_PHOTO_PATH: 'Path foto bukti kerusakan tidak valid.',
  ALREADY_PAID: 'Order ini sudah dibayar.',
  NO_ITEMS: 'Tambahkan minimal satu baris keterangan dan harga.',
  INVALID_PRICE: 'Total tagihan di luar batas yang diizinkan.',
};

function mapRpcError(message: string | null | undefined, fallback: string): Error {
  const raw = (message ?? '').trim();
  for (const [code, label] of Object.entries(INVOICE_ERROR_MESSAGES)) {
    if (raw.includes(code)) return new Error(label);
  }
  return new Error(raw || fallback);
}

/** Mengirim estimasi biaya beserta foto opsional untuk persetujuan client. */
export async function submitOrderQuote(
  requestId: string,
  photoPaths?: string[] | null,
): Promise<void> {
  const { error } = await supabase.rpc('submit_order_quote', {
    p_request_id: requestId,
    p_photo_paths: photoPaths ?? null,
  });
  if (error) throw mapRpcError(error.message, 'Gagal mengirim estimasi ke client.');
}

/** Menarik estimasi yang masih pending agar montir dapat merevisinya. */
export async function withdrawOrderQuote(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_order_quote', {
    p_request_id: requestId,
  });
  if (error) throw mapRpcError(error.message, 'Gagal menarik estimasi.');
}

/** Mengajukan biaya tambahan di tengah perbaikan setelah estimasi awal disetujui. */
export async function requestQuoteAddon(
  requestId: string,
  input: {
    description: string;
    amount: number;
    itemType?: 'service' | 'parts' | 'addon';
    photoPaths?: string[] | null;
  },
): Promise<void> {
  const description = input.description.trim();
  if (!description) throw new Error('Keterangan tambahan wajib diisi.');
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Nominal tambahan harus lebih dari 0.');
  }
  const { error } = await supabase.rpc('request_quote_addon', {
    p_request_id: requestId,
    p_description: description,
    p_amount: Math.round(input.amount),
    p_item_type: input.itemType ?? 'addon',
    p_photo_paths: input.photoPaths ?? null,
  });
  if (error) throw mapRpcError(error.message, 'Gagal mengajukan biaya tambahan.');
}

/**
 * Montir mengirim tagihan terperinci. Server menjumlahkan seluruh baris yang disetujui,
 * memvalidasi batas harga, lalu memindahkan order ke status `payment`.
 */
export async function sendOrderInvoice(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_order_invoice', {
    p_request_id: requestId,
  });
  if (error) throw mapRpcError(error.message, 'Gagal mengirim tagihan.');
}

/** Membuka kembali tagihan (`payment -> arrived`) untuk revisi sebelum dibayar. */
export async function reopenOrderInvoice(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_order_invoice', {
    p_request_id: requestId,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    if (code.includes('ALREADY_PAID')) {
      throw new Error('Tagihan tidak bisa direvisi karena pembayaran sudah lunas.');
    }
    throw mapRpcError(error.message, 'Gagal membuka ulang tagihan.');
  }
}

export async function listMyActivity(limit = 30): Promise<ActivityItem[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('activity_logs')
    .select(
      'id, activity_type, description, created_at, related_entity_type, related_entity_id',
    )
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ActivityItem[];
}

export async function logActivity(activityType: string, description: string): Promise<void> {
  try {
    const id = await getMyId();
    await supabase.from('activity_logs').insert({
      user_id: id,
      activity_type: activityType,
      description,
    });
  } catch {
    // Aktivitas bersifat pelengkap — jangan gagalkan aksi utama.
  }
}

export async function getEarningsSummary(fromISO: string): Promise<EarningsSummary> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('earnings')
    .select('gross_amount, platform_fee, net_amount, payment_method')
    .eq('mechanic_id', id)
    .gte('period_date', fromISO.slice(0, 10));
  if (error) throw error;
  const rows = (data ?? []) as {
    gross_amount: number;
    platform_fee: number;
    net_amount: number;
    payment_method: string | null;
  }[];
  return {
    totalJobs: rows.length,
    gross: rows.reduce((s, r) => s + r.gross_amount, 0),
    fee: rows.reduce((s, r) => s + r.platform_fee, 0),
    net: rows.reduce((s, r) => s + r.net_amount, 0),
    cashNet: rows.reduce(
      (s, r) => (r.payment_method === 'cash' ? s + r.net_amount : s),
      0,
    ),
  };
}
