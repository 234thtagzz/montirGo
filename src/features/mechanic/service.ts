// Data layer section montir — langsung ke Supabase (RLS menjaga otorisasi, PRD §6/§22).
import { supabase } from '@/lib/supabase';
import type {
  ActivityItem, EarningsSummary, IncomingOrder, MechanicOrderDetail, MechanicProfile, MyOrder,
  OrderStatus, OrderStatusEvent,
} from './types';

export * from './types';

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
export async function listIncomingOrders(): Promise<IncomingOrder[]> {
  const { data, error } = await supabase
    .from('service_requests')
    .select(
      'id, issue_description, symptoms, address, contact_phone, status, created_at, ' +
        'vehicles (brand, model), client:profiles!service_requests_client_id_fkey (full_name)',
    )
    .is('mechanic_id', null)
    .in('status', ['requested', 'matching'])
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    issue_description: r.issue_description as string,
    symptoms: r.symptoms as string | null,
    address: r.address as string | null,
    contact_phone: r.contact_phone as string,
    status: r.status as OrderStatus,
    created_at: r.created_at as string,
    vehicle_brand: (r.vehicles as { brand?: string } | null)?.brand ?? null,
    vehicle_model: (r.vehicles as { model?: string } | null)?.model ?? null,
    client_name: (r.client as { full_name?: string } | null)?.full_name ?? null,
  }));
}

export async function listMyOrders(onlyActive = false): Promise<MyOrder[]> {
  const id = await getMyId();
  let q = supabase
    .from('service_requests')
    .select(
      'id, issue_description, symptoms, address, contact_phone, status, price_amount, created_at, ' +
        'vehicles (brand, model), ' +
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
    vehicle_brand: (r.vehicles as { brand?: string } | null)?.brand ?? null,
    vehicle_model: (r.vehicles as { model?: string } | null)?.model ?? null,
    client_name: (r.client as { full_name?: string } | null)?.full_name ?? null,
    client_phone: (r.client as { phone_number?: string } | null)?.phone_number ?? null,
  }));
}

export async function getMyOrder(id: string): Promise<MechanicOrderDetail | null> {
  const mechanicId = await getMyId();
  const { data, error } = await supabase
    .from('service_requests')
    .select(
      'id, issue_description, symptoms, address, contact_phone, additional_notes, status, ' +
        'price_amount, created_at, updated_at, vehicles (brand, model, license_plate), ' +
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
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    vehicle_brand: (r.vehicles as { brand?: string } | null)?.brand ?? null,
    vehicle_model: (r.vehicles as { model?: string } | null)?.model ?? null,
    vehicle_plate: (r.vehicles as { license_plate?: string } | null)?.license_plate ?? null,
    client_name: (r.client as { full_name?: string } | null)?.full_name ?? null,
    client_phone: (r.client as { phone_number?: string } | null)?.phone_number ?? null,
  };
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

export async function acceptOrder(requestId: string): Promise<void> {
  const id = await getMyId();
  const { error } = await supabase
    .from('service_requests')
    .update({ mechanic_id: id, status: 'mechanic_accepted', accepted_at: new Date().toISOString() })
    .eq('id', requestId)
    .is('mechanic_id', null)
    .in('status', ['requested', 'matching']);
  if (error) throw error;
  await supabase.from('service_request_status_history').insert({
    request_id: requestId,
    from_status: 'matching',
    to_status: 'mechanic_accepted',
    changed_by: id,
    notes: 'Montir menerima order.',
  });
  await logActivity('order_accepted', `Menerima order ${requestId.slice(0, 8)}.`);
}

export async function updateOrderStatus(requestId: string, toStatus: OrderStatus): Promise<void> {
  const id = await getMyId();
  const { data: current } = await supabase
    .from('service_requests')
    .select('status')
    .eq('id', requestId)
    .single();
  const { error } = await supabase
    .from('service_requests')
    .update({ status: toStatus })
    .eq('id', requestId)
    .eq('mechanic_id', id);
  if (error) throw error;
  await supabase.from('service_request_status_history').insert({
    request_id: requestId,
    from_status: (current as { status?: string } | null)?.status ?? null,
    to_status: toStatus,
    changed_by: id,
  });
  await logActivity('order_status', `Order ${requestId.slice(0, 8)} -> ${toStatus}.`);
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
    .select('gross_amount, platform_fee, net_amount')
    .eq('mechanic_id', id)
    .gte('period_date', fromISO.slice(0, 10));
  if (error) throw error;
  const rows = (data ?? []) as { gross_amount: number; platform_fee: number; net_amount: number }[];
  return {
    totalJobs: rows.length,
    gross: rows.reduce((s, r) => s + r.gross_amount, 0),
    fee: rows.reduce((s, r) => s + r.platform_fee, 0),
    net: rows.reduce((s, r) => s + r.net_amount, 0),
  };
}
