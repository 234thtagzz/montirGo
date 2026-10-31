import { Brand } from '@/constants/brand';
import type { IconName } from '@/components/ui/icon';

export type OrderStatus =
  | 'requested'
  | 'matching'
  | 'mechanic_assigned'
  | 'mechanic_accepted'
  | 'on_the_way'
  | 'arrived'
  | 'diagnosing'
  | 'repairing'
  | 'completed'
  | 'payment'
  | 'paid'
  | 'cancelled';

export interface StatusMeta {
  label: string;
  shortLabel: string;
  color: string;
  background: string;
  icon: IconName;
  /** Langkah 1-6 pada indikator progres; 0 untuk status batal. */
  step: number;
}

/** Jumlah langkah pada indikator progres order. */
export const TOTAL_STEPS = 6;

const META: Record<OrderStatus, StatusMeta> = {
  requested: {
    label: 'Mencari montir',
    shortLabel: 'Mencari montir',
    color: Brand.amber,
    background: Brand.amberSoft,
    icon: 'search-outline',
    step: 1,
  },
  matching: {
    label: 'Mencocokkan montir terdekat',
    shortLabel: 'Mencari montir',
    color: Brand.amber,
    background: Brand.amberSoft,
    icon: 'search-outline',
    step: 1,
  },
  mechanic_assigned: {
    label: 'Montir ditemukan',
    shortLabel: 'Montir ditemukan',
    color: Brand.primary,
    background: Brand.blueSoft,
    icon: 'person-add-outline',
    step: 2,
  },
  mechanic_accepted: {
    label: 'Montir menerima pesanan',
    shortLabel: 'Diterima montir',
    color: Brand.primary,
    background: Brand.blueSoft,
    icon: 'checkmark-circle-outline',
    step: 2,
  },
  on_the_way: {
    label: 'Montir menuju lokasimu',
    shortLabel: 'Menuju lokasi',
    color: Brand.primary,
    background: Brand.blueSoft,
    icon: 'navigate-outline',
    step: 3,
  },
  arrived: {
    label: 'Montir tiba di lokasi',
    shortLabel: 'Montir tiba',
    color: Brand.primary,
    background: Brand.blueSoft,
    icon: 'location-outline',
    step: 4,
  },
  diagnosing: {
    label: 'Montir sedang mendiagnosis',
    shortLabel: 'Diagnosis',
    color: Brand.primary,
    background: Brand.blueSoft,
    icon: 'medkit-outline',
    step: 4,
  },
  repairing: {
    label: 'Kendaraan sedang diperbaiki',
    shortLabel: 'Diperbaiki',
    color: Brand.primary,
    background: Brand.blueSoft,
    icon: 'construct-outline',
    step: 4,
  },
  completed: {
    label: 'Pekerjaan selesai',
    shortLabel: 'Selesai',
    color: Brand.green,
    background: Brand.greenSoft,
    icon: 'checkmark-done-outline',
    step: 5,
  },
  payment: {
    label: 'Menunggu pembayaran',
    shortLabel: 'Pembayaran',
    color: Brand.amber,
    background: Brand.amberSoft,
    icon: 'wallet-outline',
    step: 5,
  },
  paid: {
    label: 'Pembayaran lunas',
    shortLabel: 'Lunas',
    color: Brand.green,
    background: Brand.greenSoft,
    icon: 'shield-checkmark-outline',
    step: 6,
  },
  cancelled: {
    label: 'Pesanan dibatalkan',
    shortLabel: 'Dibatalkan',
    color: Brand.red,
    background: Brand.redSoft,
    icon: 'close-circle-outline',
    step: 0,
  },
};

export function getStatusMeta(status: string): StatusMeta {
  return META[status as OrderStatus] ?? META.requested;
}

export function isActiveStatus(status: string): boolean {
  return status !== 'paid' && status !== 'cancelled';
}

export function isCancellable(status: string): boolean {
  return status === 'requested' || status === 'matching';
}

/** Label progres singkat untuk kartu pesanan aktif (ala Gojek). */
export function getProgressLabel(status: string): string {
  const step = getStatusMeta(status).step;
  if (step === 0) return 'Pesanan dibatalkan';
  if (step === 1) return 'Mencari montir terdekat';
  if (step === 2) return 'Montir menerima pesananmu';
  if (step === 3) return 'Montir sedang menuju lokasi';
  if (step === 4) return 'Montir sudah tiba di lokasi';
  if (step === 5) return 'Menunggu pembayaran';
  return 'Pembayaran lunas';
}
