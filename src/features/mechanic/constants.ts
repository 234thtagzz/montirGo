import { Brand } from '@/constants/brand';
import type { IconName } from '@/components/ui/icon';
import type { OrderStatus } from './types';

/** Meta tampilan untuk tiap jenis aktivitas (dipakai layar Aktivitas). */
export interface ActivityMeta {
  label: string;
  icon: IconName;
  color: string;
  background: string;
}

const ACTIVITY_META: Record<string, ActivityMeta> = {
  online_status: {
    label: 'Status online',
    icon: 'power-outline',
    color: Brand.primary,
    background: Brand.primarySoft,
  },
  order_accepted: {
    label: 'Order diterima',
    icon: 'checkmark-circle-outline',
    color: Brand.green,
    background: Brand.greenSoft,
  },
  order_status: {
    label: 'Perbarui status order',
    icon: 'sync-outline',
    color: Brand.primary,
    background: Brand.primarySoft,
  },
  payment_received: {
    label: 'Pembayaran diterima',
    icon: 'cash-outline',
    color: Brand.green,
    background: Brand.greenSoft,
  },
  withdrawal: {
    label: 'Pencairan saldo',
    icon: 'wallet-outline',
    color: Brand.primary,
    background: Brand.primarySoft,
  },
  login: {
    label: 'Masuk aplikasi',
    icon: 'log-in-outline',
    color: Brand.textSecondary,
    background: Brand.divider,
  },
};

const FALLBACK_ACTIVITY: ActivityMeta = {
  label: 'Aktivitas',
  icon: 'pulse-outline',
  color: Brand.textSecondary,
  background: Brand.divider,
};

export function getActivityMeta(type: string): ActivityMeta {
  return ACTIVITY_META[type] ?? FALLBACK_ACTIVITY;
}

/** Aksi lanjutan yang bisa dilakukan montir untuk tiap status order. */
const NEXT_ACTION: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string; icon: IconName }>
> = {
  mechanic_assigned: { next: 'on_the_way', label: 'Mulai Perjalanan', icon: 'navigate-outline' },
  mechanic_accepted: { next: 'on_the_way', label: 'Mulai Perjalanan', icon: 'navigate-outline' },
  on_the_way: { next: 'arrived', label: 'Sampai di Lokasi', icon: 'location-outline' },
  arrived: { next: 'diagnosing', label: 'Mulai Diagnosis', icon: 'medkit-outline' },
  diagnosing: { next: 'repairing', label: 'Mulai Perbaikan', icon: 'construct-outline' },
  repairing: { next: 'completed', label: 'Selesaikan Pekerjaan', icon: 'checkmark-done-outline' },
};

export function getNextAction(status: string) {
  return NEXT_ACTION[status as OrderStatus] ?? null;
}

/** Label progres dari sudut pandang montir (bukan client). */
const PROGRESS_LABEL: Record<string, string> = {
  mechanic_assigned: 'Order diberikan kepadamu',
  mechanic_accepted: 'Kamu menerima order ini',
  on_the_way: 'Sedang menuju lokasi pelanggan',
  arrived: 'Sudah tiba di lokasi',
  diagnosing: 'Sedang mendiagnosis kendaraan',
  repairing: 'Sedang memperbaiki kendaraan',
  completed: 'Pekerjaan selesai',
  payment: 'Menunggu pembayaran client',
  paid: 'Pembayaran lunas',
  cancelled: 'Order dibatalkan',
};

export function getMechanicProgressLabel(status: string): string {
  return PROGRESS_LABEL[status] ?? 'Order aktif';
}
