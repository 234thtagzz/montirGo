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
