// Data layer section montir — langsung ke Supabase (RLS menjaga otorisasi, PRD §6/§22).
import { supabase } from '@/lib/supabase';
import {
  mapAiAnalysis,
  type RawAiAnalysis,
} from '@/features/service-request/ai';
import type {
  ActivityItem, EarningsSummary, IncomingOrder, IncomingRequestDetail, MechanicLocationPoint,
  MechanicOrderDetail, MechanicProfile, MyOrder, OrderStatus, OrderStatusEvent,
} from './types';

export * from './types';

const OPEN_REQUEST_STATUSES = ['requested', 'matching'];

const ACTIVE_STATUSES = [
  'mechanic_accepted', 'on_the_way', 'arrived', 'diagnosing', 'repairing', 'completed', 'payment',
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

export async function updateMechanicProfile(patch: {
  workshop_name?: string;
  skills?: string[];
  vehicle_specialization?: string[];
}): Promise<void> {
  const id = await getMyId();
  const { error } = await supabase
    .from('mechanic_profiles')
    .upsert({ profile_id: id, ...patch }, { onConflict: 'profile_id' });
  if (error) throw error;
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
  let q = supabase
    .from('service_requests')
    .select(
      'id, issue_description, symptoms, address, contact_phone, status, price_amount, created_at, ' +
        'vehicles (type, brand, model), ' +
        'client:profiles!service_requests_client_id_fkey (full_name, phone_number)',
    )
    .eq('mechanic_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (onlyActive) q = q.in('status', ACTIVE_STATUSES);
  const { data, error } = await q;
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
  const { data, error } = await supabase
    .from('service_requests')
    .select(
      'id, issue_description, symptoms, address, lat, lng, contact_phone, additional_notes, status, ' +
        'price_amount, payment_method, created_at, updated_at, accepted_at, arrived_at, ' +
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
 * yang belum menjalankan migrasi RPC).
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

  const { data: accepted, error: updateError } = await supabase
    .from('service_requests')
    .update({ mechanic_id: id, status: 'mechanic_accepted', accepted_at: new Date().toISOString() })
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
    from_status: (current as { status?: string } | null)?.status ?? null,
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
  mechanic_assigned: (shortId) => `Order #${shortId} diberikan kepadamu.`,
  mechanic_accepted: (shortId) => `Kamu menerima order #${shortId}.`,
  on_the_way: (shortId) => `Kamu mulai menuju lokasi order #${shortId}.`,
  arrived: (shortId) =>
    `Kamu tiba di lokasi order #${shortId}. Lanjut isi tagihan untuk client.`,
  payment: (shortId) => `Tagihan order #${shortId} terkirim, menunggu pembayaran client.`,
  paid: (shortId) => `Pembayaran order #${shortId} sudah lunas.`,
  cancelled: (shortId) => `Order #${shortId} dibatalkan.`,
};

const PRICE_ERROR_MESSAGES: Record<string, string> = {
  INVALID_STATUS: 'Tagihan bisa diisi setelah kamu tiba di lokasi client.',
  INVALID_PRICE: 'Nominal tagihan tidak valid atau di luar batas yang diizinkan.',
  ALREADY_PAID: 'Order ini sudah dibayar.',
  NOT_YOUR_ORDER: 'Order ini bukan milikmu.',
  REQUEST_NOT_FOUND: 'Order tidak ditemukan.',
  UNAUTHORIZED: 'Sesi berakhir. Silakan login kembali.',
};

/**
 * Montir menetapkan tagihan final. RPC memindahkan status order ke `payment`
 * sehingga client bisa membayar lewat Xendit.
 */
export async function setOrderPrice(requestId: string, price: number): Promise<void> {
  const { error } = await supabase.rpc('set_order_price', {
    p_request_id: requestId,
    p_price: Math.round(price),
  });
  if (error) {
    const code = (error.message ?? '').trim();
    throw new Error(PRICE_ERROR_MESSAGES[code] ?? code ?? 'Gagal menyimpan tagihan.');
  }
  await logActivity(
    'invoice_sent',
    `Tagihan order ${requestId.slice(0, 8).toUpperCase()} sebesar ` +
      `Rp${price.toLocaleString('id-ID')} dikirim ke client.`,
  );
}

export async function listMyActivity(limit = 30): Promise<ActivityItem[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, activity_type, description, created_at')
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
