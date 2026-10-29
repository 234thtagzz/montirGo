import type { AiAnalysis, AiRiskLevel } from '@/features/service-request/ai';

export type OrderStatus =
  | 'requested' | 'matching' | 'mechanic_assigned' | 'mechanic_accepted'
  | 'on_the_way' | 'arrived' | 'diagnosing' | 'repairing'
  | 'completed' | 'payment' | 'paid' | 'cancelled';

export interface MechanicProfile {
  profile_id: string;
  workshop_name: string | null;
  skills: string[];
  vehicle_specialization: string[];
  is_online: boolean;
  is_available: boolean;
  is_verified: boolean;
  rating_avg: number;
  total_jobs: number;
}

export interface IncomingOrder {
  id: string;
  issue_description: string;
  symptoms: string | null;
  address: string | null;
  contact_phone: string;
  status: OrderStatus;
  created_at: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  client_name: string | null;
  /** Tingkat risiko dari analisis AI terbaru (null bila belum ada). */
  ai_risk_level: AiRiskLevel | null;
  has_analysis: boolean;
}

/** Detail request terbuka (sebelum diterima) untuk layar otorisasi montir. */
export interface IncomingRequestDetail {
  id: string;
  status: OrderStatus;
  issue_description: string;
  symptoms: string | null;
  address: string | null;
  lat: number;
  lng: number;
  contact_phone: string;
  additional_notes: string | null;
  created_at: string;
  client_name: string | null;
  vehicle_type: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_plate: string | null;
  ai_analysis: AiAnalysis | null;
  ai_created_at: string | null;
}

export interface MyOrder {
  id: string;
  issue_description: string;
  symptoms: string | null;
  address: string | null;
  contact_phone: string;
  status: OrderStatus;
  price_amount: number | null;
  created_at: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  client_name: string | null;
  client_phone: string | null;
}

export interface MechanicOrderDetail extends MyOrder {
  additional_notes: string | null;
  vehicle_plate: string | null;
  updated_at: string;
  /** Titik lokasi client — dipakai layar perjalanan (trip mode). */
  lat: number;
  lng: number;
  accepted_at: string | null;
  arrived_at: string | null;
}

/** Satu titik jejak perjalanan montir. */
export interface MechanicLocationPoint {
  lat: number;
  lng: number;
  accuracy_meters: number | null;
  recorded_at: string;
}

export interface OrderStatusEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  notes: string | null;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  activity_type: string;
  description: string | null;
  created_at: string;
}

export interface EarningsSummary {
  totalJobs: number;
  gross: number;
  fee: number;
  net: number;
}
