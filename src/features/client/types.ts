import type { OrderStatus } from '@/features/service-request/status';

export type VehicleType = 'motor' | 'mobil' | 'lainnya';

export interface ClientVehicle {
  id: string;
  owner_id: string;
  type: VehicleType;
  brand: string;
  model: string;
  year: number | null;
  license_plate: string;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface ClientOrder {
  id: string;
  status: OrderStatus;
  issue_description: string;
  symptoms: string | null;
  address: string | null;
  contact_phone: string;
  additional_notes: string | null;
  price_amount: number | null;
  /** Pilihan metode pembayaran client saat order berstatus `payment`. */
  payment_method: 'online' | 'cash' | null;
  created_at: string;
  updated_at: string;
  vehicle_id: string | null;
  mechanic_id: string | null;
  vehicle_type: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_plate: string | null;
  /** Path foto kendaraan di bucket privat `vehicle-photos`. */
  vehicle_photo_url: string | null;
  mechanic_name: string | null;
  mechanic_phone: string | null;
  mechanic_avatar: string | null;
}

export interface NearbyMechanic {
  profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
  workshop_name: string | null;
  rating_avg: number;
  total_jobs: number;
  is_online: boolean;
}

export interface OrderStatusEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  created_at: string;
}

export interface ClientNotification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface CreateServiceRequestInput {
  clientId: string;
  vehicleId?: string | null;
  issueDescription: string;
  symptoms?: string | null;
  lat: number;
  lng: number;
  address?: string | null;
  contactPhone: string;
  additionalNotes?: string | null;
}

export interface VehicleInput {
  type: VehicleType;
  brand: string;
  model: string;
  year?: number | null;
  license_plate: string;
  notes?: string | null;
  /** Path objek foto di bucket `vehicle-photos` (bukan URL publik). */
  photo_url?: string | null;
}
