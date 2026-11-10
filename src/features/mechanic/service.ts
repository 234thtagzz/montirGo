// Data layer section montir — langsung ke Supabase (RLS menjaga otorisasi, PRD §6/§22).
import { supabase } from '@/lib/supabase';
import {
  mapAiAnalysis,
  type RawAiAnalysis,
} from '@/features/service-request/ai';
import type {
  ActivityItem, EarningsSummary, IncomingOrder, IncomingRequestDetail, MechanicCertification,
  MechanicCertificationInput, MechanicLocationPoint, MechanicOrderDetail, MechanicProfile,
  MechanicProfilePatch, MechanicReview, MyOrder, OrderInvoiceItem, OrderStatus, OrderStatusEvent,
} from './types';

export * from './types';

const OPEN_REQUEST_STATUSES = ['requested', 'matching'];

/** Error kolom/hubungan yang muncul saat cache skema PostgREST belum sinkron. */
function isEmbedError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST200' ||
    error.code === 'PGRST204' ||
    /column .* does not exist|could not find the '.*' column|could not find a relationship|schema cache/i.test(
      error.message ?? '',
    )
  );
}

const ACTIVE_STATUSES = [
  'mechanic_assigned', 'mechanic_accepted', 'on_the_way', 'arrived', 'diagnosing', 'repairing',
  'completed', 'payment',
];

export async function getMyId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi berakhir. Silakan login kembali.');
  return user.id;
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

export async function setOnlineStatus(isOnline: boolean): Promise<void> {
  const id = await getMyId();
  const { error } = await supabase.from('mechanic_profiles').upsert(
    { profile_id: id, is_online: isOnline, is_available: true },
    { onConflict: 'profile_id' },
  );
  if (error) throw error;
  await logActivity('online_status', isOnline ? 'Montir online, siap menerima order.' : 'Montir offline.');
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

// ---------- Sertifikasi ----------

export async function listMechanicCertifications(): Promise<MechanicCertification[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('mechanic_certifications')
    .select('*')
    .eq('mechanic_id', id)
    .order('issued_year', { ascending: false });
  if (error) throw error;
  return (data ?? []) as MechanicCertification[];
}

export async function replaceMechanicCertifications(
  inputs: MechanicCertificationInput[],
): Promise<void> {
  const id = await getMyId();
  const rows = inputs
    .map((input) => ({
      mechanic_id: id,
      title: input.title.trim(),
      issuer: input.issuer?.trim() || null,
      issued_year: input.issued_year ?? null,
      certificate_url: input.certificate_url?.trim() || null,
      is_verified: false,
    }))
    .filter((row) => row.title.length > 0);

  const { error: deleteError } = await supabase
    .from('mechanic_certifications')
    .delete()
    .eq('mechanic_id', id);
  if (deleteError) throw deleteError;

  if (rows.length === 0) return;
  const { error } = await supabase.from('mechanic_certifications').insert(rows);
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

const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sesi berakhir. Silakan login kembali.',
  REVIEW_NOT_FOUND: 'Ulasan tidak ditemukan atau bukan milikmu.',
};

export async function replyToReview(reviewId: string, reply: string): Promise<void> {
  const { error } = await supabase.rpc('reply_to_review', {
    p_review_id: reviewId,
    p_reply: reply,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    throw new Error(REVIEW_ERROR_MESSAGES[code] ?? code ?? 'Gagal menyimpan balasan.');
  }
}

// Order terbuka yang bisa diambil (khusus role mechanic, sesuai RLS).
// Sumber utama: view `mechanic_open_request_view` (data client + kendaraan +
// ringkasan AI). Fallback ke query lama bila migration view belum dijalankan.
export async function listIncomingOrders(): Promise<IncomingOrder[]> {
  const { data, error } = await supabase
    .from('mechanic_open_request_view')
    .select(
      'id, issue_description, symptoms, address, contact_phone, status, created_at, ' +
        'vehicle_type, vehicle_brand, vehicle_model, vehicle_photo_url, client_name, ai_analysis',
    )
    .order('created_at', { ascending: false })
    .limit(30);

  // Jangan percaya hasil kosong dari view secara membabi buta: view bisa saja
  // belum ter-update di database. Fallback ke query langsung tetap benar.
  if (!error && data && data.length > 0) {
    return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
      const analysis = mapAiAnalysis(r.ai_analysis as RawAiAnalysis | null);
      return {
        id: r.id as string,
        issue_description: r.issue_description as string,
        symptoms: (r.symptoms as string | null) ?? null,
        address: (r.address as string | null) ?? null,
        contact_phone: r.contact_phone as string,
        status: r.status as OrderStatus,
        created_at: r.created_at as string,
        vehicle_type: (r.vehicle_type as string | null) ?? null,
        vehicle_brand: (r.vehicle_brand as string | null) ?? null,
        vehicle_model: (r.vehicle_model as string | null) ?? null,
        client_name: (r.client_name as string | null) ?? null,
        ai_risk_level: analysis?.riskLevel ?? null,
        has_analysis: analysis !== null,
      };
    });
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('service_requests')
    .select(
      'id, issue_description, symptoms, address, contact_phone, status, created_at, ' +
        'vehicles (type, brand, model), client:profiles!service_requests_client_id_fkey (full_name)',
    )
    .is('mechanic_id', null)
    .in('status', OPEN_REQUEST_STATUSES)
    .order('created_at', { ascending: false })
    .limit(30);
  if (fallbackError) throw fallbackError;
  return ((fallback ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    issue_description: r.issue_description as string,
    symptoms: r.symptoms as string | null,
    address: r.address as string | null,
    contact_phone: r.contact_phone as string,
    status: r.status as OrderStatus,
    created_at: r.created_at as string,
    vehicle_type: (r.vehicles as { type?: string } | null)?.type ?? null,
    vehicle_brand: (r.vehicles as { brand?: string } | null)?.brand ?? null,
    vehicle_model: (r.vehicles as { model?: string } | null)?.model ?? null,
    client_name: (r.client as { full_name?: string } | null)?.full_name ?? null,
    ai_risk_level: null,
    has_analysis: false,
  }));
}

/**
 * Detail request terbuka untuk layar otorisasi montir (sebelum menerima).
 * Mengembalikan null bila request sudah diambil montir lain / dibatalkan.
 */
export async function getIncomingRequestDetail(
  id: string,
): Promise<IncomingRequestDetail | null> {
  const { data, error } = await supabase
    .from('mechanic_open_request_view')
    .select(
      'id, status, issue_description, symptoms, address, lat, lng, contact_phone, ' +
        'additional_notes, created_at, client_name, vehicle_type, vehicle_brand, ' +
        'vehicle_model, vehicle_year, vehicle_plate, vehicle_photo_url, ai_analysis, ai_created_at',
    )
    .eq('id', id)
    .maybeSingle();

  // Fallback juga ketika view mengembalikan kosong (mis. view lama/belum
  // ter-sync). Hanya query langsung yang boleh menyimpulkan request hilang.
  if (!error && data) {
    return mapIncomingDetail(data as unknown as Record<string, unknown>);
  }

  // Fallback: view belum ada. Data AI & nama client bisa kosong karena RLS.
  const { data: fallback, error: fallbackError } = await supabase
    .from('service_requests')
    .select(
      'id, status, issue_description, symptoms, address, lat, lng, contact_phone, ' +
        'additional_notes, created_at, vehicles ( type, brand, model, year, license_plate, photo_url ), ' +
        'client:profiles!service_requests_client_id_fkey ( full_name )',
    )
    .eq('id', id)
    .is('mechanic_id', null)
    .in('status', OPEN_REQUEST_STATUSES)
    .maybeSingle();
  if (fallbackError) throw fallbackError;
  if (!fallback) return null;

  const r = fallback as unknown as Record<string, unknown>;
  const vehicle = r.vehicles as {
    type?: string | null;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    license_plate?: string | null;
    photo_url?: string | null;
  } | null;
  return {
    id: r.id as string,
    status: r.status as OrderStatus,
    issue_description: r.issue_description as string,
    symptoms: (r.symptoms as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    contact_phone: r.contact_phone as string,
    additional_notes: (r.additional_notes as string | null) ?? null,
    created_at: r.created_at as string,
    client_name: (r.client as { full_name?: string } | null)?.full_name ?? null,
    vehicle_type: vehicle?.type ?? null,
    vehicle_brand: vehicle?.brand ?? null,
    vehicle_model: vehicle?.model ?? null,
    vehicle_year: vehicle?.year ?? null,
    vehicle_plate: vehicle?.license_plate ?? null,
    vehicle_photo_url: vehicle?.photo_url ?? null,
    ai_analysis: null,
    ai_created_at: null,
  };
}

function mapIncomingDetail(r: Record<string, unknown>): IncomingRequestDetail {
  return {
    id: r.id as string,
    status: r.status as OrderStatus,
    issue_description: r.issue_description as string,
    symptoms: (r.symptoms as string | null) ?? null,
    address: (r.address as string | null) ?? null,
    lat: Number(r.lat),
    lng: Number(r.lng),
    contact_phone: r.contact_phone as string,
    additional_notes: (r.additional_notes as string | null) ?? null,
    created_at: r.created_at as string,
    client_name: (r.client_name as string | null) ?? null,
    vehicle_type: (r.vehicle_type as string | null) ?? null,
    vehicle_brand: (r.vehicle_brand as string | null) ?? null,
    vehicle_model: (r.vehicle_model as string | null) ?? null,
    vehicle_year: (r.vehicle_year as number | null) ?? null,
    vehicle_plate: (r.vehicle_plate as string | null) ?? null,
    vehicle_photo_url: (r.vehicle_photo_url as string | null) ?? null,
    ai_analysis: mapAiAnalysis(r.ai_analysis as RawAiAnalysis | null),
    ai_created_at: (r.ai_created_at as string | null) ?? null,
  };
}

export async function listMyOrders(onlyActive = false): Promise<MyOrder[]> {
  const id = await getMyId();
  const selectWithRelations =
    'id, issue_description, symptoms, address, contact_phone, status, price_amount, created_at, ' +
    'vehicles (type, brand, model), ' +
    'client:profiles!service_requests_client_id_fkey (full_name, phone_number)';
  const selectFlat =
    'id, issue_description, symptoms, address, contact_phone, status, price_amount, created_at';

  const query = (select: string) => {
    let q = supabase.from('service_requests').select(select).eq('mechanic_id', id);
    if (onlyActive) q = q.in('status', ACTIVE_STATUSES);
    return q.order('created_at', { ascending: false }).limit(50);
  };

  let { data, error } = await query(selectWithRelations);
  if (error && isEmbedError(error)) {
    // Cache skema PostgREST basi: tetap tampilkan order tanpa detail relasi.
    ({ data, error } = await query(selectFlat));
  }
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
  const baseSelect =
    'id, issue_description, symptoms, address, lat, lng, contact_phone, additional_notes, status, ' +
    'price_amount, payment_method, created_at, updated_at, accepted_at, arrived_at, ' +
    'vehicles (type, brand, model, year, license_plate, photo_url), ' +
    'client:profiles!service_requests_client_id_fkey (full_name, phone_number)';
  const query = (select: string) =>
    supabase
      .from('service_requests')
      .select(select)
      .eq('id', id)
      .eq('mechanic_id', mechanicId)
      .maybeSingle();

  let { data, error } = await query(
    'id, issue_description, symptoms, address, lat, lng, contact_phone, additional_notes, status, ' +
      'price_amount, payment_method, created_at, updated_at, accepted_at, arrived_at, ' +
      'assignment_requested_at, assignment_expires_at, ' +
      'vehicles (type, brand, model, year, license_plate, photo_url), ' +
      'client:profiles!service_requests_client_id_fkey (full_name, phone_number)',
  );
  if (error && isEmbedError(error)) {
    // Migration konfirmasi montir belum dijalankan / cache skema basi — tetap
    // tampilkan order dengan kolom dasar.
    ({ data, error } = await query(baseSelect));
  }
  if (error && isEmbedError(error)) {
    ({ data, error } = await query(
      'id, issue_description, symptoms, address, lat, lng, contact_phone, additional_notes, ' +
        'status, price_amount, payment_method, created_at, updated_at, accepted_at, arrived_at',
    ));
  }
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
  input: { lat: number; lng: number; accuracy?: number | null },
): Promise<void> {
  const { error } = await supabase.rpc('record_mechanic_location', {
    p_request_id: requestId,
    p_lat: input.lat,
    p_lng: input.lng,
    p_accuracy: input.accuracy ?? null,
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

function isRpcMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function|function .* does not exist/i.test(error.message ?? '')
  );
}

/**
 * Menerima request secara atomik.
 *
 * Utama: RPC `accept_service_request` (SECURITY DEFINER). Fungsi ini mengunci
 * baris request, memastikan belum diambil montir lain, lalu mengubah
 * mechanic_id + status dalam satu transaksi. Ini mencegah dua montir menang
 * bersamaan dan tidak bergantung pada policy RLS dari client.
 *
 * Fallback: update langsung dengan syarat `mechanic_id is null` (untuk database
 * yang belum menjalankan migrasi RPC). Status yang dipakai tetap
 * `mechanic_assigned` supaya client tetap harus mengonfirmasi.
 */
export async function acceptOrder(requestId: string): Promise<void> {
  const id = await getMyId();

  // Satu montir hanya boleh memegang satu order aktif. RPC juga memeriksa ini
  // di server; cek di sini supaya pesan errornya langsung ramah.
  const activeOrderId = await getMyActiveOrderId(id).catch(() => null);
  if (activeOrderId) throw new Error(ACTIVE_ORDER_MESSAGE);

  const { data, error } = await supabase.rpc(ACCEPT_RPC, { p_request_id: requestId });
  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as
      | { id?: string; mechanic_id?: string | null }
      | null;
    if (!row?.id || row.mechanic_id !== id) {
      throw new Error('Request sudah diambil montir lain atau sudah tidak tersedia.');
    }
    return;
  }

  if (!isRpcMissing(error)) {
    throw new Error(error.message || 'Request sudah diambil montir lain atau tidak tersedia.');
  }

  const requestedAt = new Date();
  const { data: accepted, error: updateError } = await supabase
    .from('service_requests')
    .update({
      mechanic_id: id,
      status: 'mechanic_assigned',
      accepted_at: null,
      assignment_requested_at: requestedAt.toISOString(),
      assignment_expires_at: new Date(requestedAt.getTime() + 5 * 60_000).toISOString(),
    })
    .eq('id', requestId)
    .is('mechanic_id', null)
    .in('status', ['requested', 'matching'])
    .select('id');
  if (updateError) throw updateError;
  if (!accepted || accepted.length === 0) {
    // Bedakan "sudah diambil montir lain" dari policy database yang belum siap.
    const { data: current } = await supabase
      .from('service_requests')
      .select('mechanic_id, status')
      .eq('id', requestId)
      .maybeSingle();
    const stillOpen =
      current != null &&
      (current as { mechanic_id?: string | null }).mechanic_id == null &&
      ['requested', 'matching'].includes((current as { status?: string }).status ?? '');
    if (stillOpen) {
      throw new Error(
        'Server belum mengizinkan pengambilan order. Jalankan migrasi database ' +
          '(supabase db push) lalu coba lagi.',
      );
    }
    throw new Error('Request sudah diambil montir lain atau sudah tidak tersedia.');
  }
  await supabase.from('service_request_status_history').insert({
    request_id: requestId,
    from_status: 'matching',
    to_status: 'mechanic_accepted',
    changed_by: id,
    notes: 'Montir menerima order.',
  });
  await logActivity('order_accepted', `Menerima order ${requestId.slice(0, 8)}.`);
}

/** Kolom waktu yang harus ikut terisi saat status berubah (PRD §16). */
const STATUS_TIMESTAMP: Partial<Record<OrderStatus, string>> = {
  mechanic_accepted: 'accepted_at',
  arrived: 'arrived_at',
  completed: 'completed_at',
};

export async function updateOrderStatus(requestId: string, toStatus: OrderStatus): Promise<void> {
  const id = await getMyId();
  const { data: current } = await supabase
    .from('service_requests')
    .select('status')
    .eq('id', requestId)
    .single();
  const currentStatus = (current as { status?: string } | null)?.status ?? null;

  // `mechanic_assigned` berarti montir baru mengajukan diri. Hanya client yang
  // boleh keluar dari status ini lewat RPC `respond_to_assignment`.
  if (currentStatus === 'mechanic_assigned') {
    throw new Error(
      'Pesanan masih menunggu konfirmasi client. Kamu bisa mulai setelah client menyetujui.',
    );
  }
  if (toStatus === 'mechanic_assigned' || toStatus === 'mechanic_accepted') {
    throw new Error(
      'Status ini hanya bisa diubah lewat alur pengajuan montir dan konfirmasi client.',
    );
  }

  const timestampColumn = STATUS_TIMESTAMP[toStatus];
  const patch: Record<string, unknown> = { status: toStatus };
  if (timestampColumn) patch[timestampColumn] = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('service_requests')
    .update(patch)
    .eq('id', requestId)
    .eq('mechanic_id', id)
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('Status order gagal diubah. Pastikan order masih milikmu.');
  }
  await supabase.from('service_request_status_history').insert({
    request_id: requestId,
    from_status: currentStatus,
    to_status: toStatus,
    changed_by: id,
  });
  const shortId = requestId.slice(0, 8).toUpperCase();
  await logActivity(
    toStatus === 'arrived' ? 'order_arrived' : 'order_status',
    ACTIVITY_DESCRIPTION[toStatus]?.(shortId) ?? `Order ${shortId} -> ${toStatus}.`,
  );
}

/** Kalimat aktivitas yang ramah dibaca di layar Aktivitas montir. */
const ACTIVITY_DESCRIPTION: Partial<Record<OrderStatus, (shortId: string) => string>> = {
  mechanic_assigned: (shortId) => `Mengajukan diri untuk order #${shortId}, menunggu konfirmasi client.`,
  mechanic_accepted: (shortId) => `Kamu menerima order #${shortId}.`,
  on_the_way: (shortId) => `Kamu mulai menuju lokasi order #${shortId}.`,
  arrived: (shortId) =>
    `Kamu tiba di lokasi order #${shortId}. Lanjut isi tagihan untuk client.`,
  payment: (shortId) => `Tagihan order #${shortId} terkirim, menunggu pembayaran client.`,
  paid: (shortId) => `Pembayaran order #${shortId} sudah lunas.`,
  cancelled: (shortId) => `Order #${shortId} dibatalkan.`,
};

// ---------- Tagihan terperinci ----------

const INVOICE_ITEM_SELECT =
  'id, request_id, mechanic_id, keterangan, harga, created_at, updated_at';

/** Semua baris tagihan milik satu order, urut sesuai urutan dibuat. */
export async function listOrderInvoiceItems(
  requestId: string,
): Promise<OrderInvoiceItem[]> {
  const { data, error } = await supabase
    .from('order_invoice_items')
    .select(INVOICE_ITEM_SELECT)
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrderInvoiceItem[];
}

/** Montir menambah satu baris keterangan + harga sebelum mengirim tagihan. */
export async function addOrderInvoiceItem(
  requestId: string,
  input: { keterangan: string; harga: number },
): Promise<OrderInvoiceItem> {
  const mechanicId = await getMyId();
  const keterangan = input.keterangan.trim();
  if (!keterangan) throw new Error('Keterangan wajib diisi.');
  if (!Number.isFinite(input.harga) || input.harga <= 0) {
    throw new Error('Harga harus lebih dari 0.');
  }

  const { data, error } = await supabase
    .from('order_invoice_items')
    .insert({
      request_id: requestId,
      mechanic_id: mechanicId,
      keterangan,
      harga: Math.round(input.harga),
    })
    .select(INVOICE_ITEM_SELECT)
    .single();
  if (error) throw error;
  return data as OrderInvoiceItem;
}

/** Hapus satu baris selama tagihan belum dikirim. */
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
  INVALID_STATUS: 'Tagihan bisa dikirim setelah kamu tiba di lokasi client.',
  ALREADY_PAID: 'Order ini sudah dibayar.',
  NO_ITEMS: 'Tambahkan minimal satu baris keterangan dan harga.',
  INVALID_PRICE: 'Total tagihan di luar batas yang diizinkan.',
};

/**
 * Montir mengirim tagihan terperinci. Server menjumlahkan seluruh baris,
 * memvalidasi batas harga, lalu memindahkan order ke status `payment`.
 */
export async function sendOrderInvoice(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_order_invoice', {
    p_request_id: requestId,
  });
  if (error) {
    const code = (error.message ?? '').trim();
    throw new Error(INVOICE_ERROR_MESSAGES[code] ?? code ?? 'Gagal mengirim tagihan.');
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
