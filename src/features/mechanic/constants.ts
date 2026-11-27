import type { IconName } from '@/components/ui/icon';
import type { SemanticTone } from '@/theme';
import type { OrderStatus, QuoteStatus } from './types';

/** Meta tampilan untuk tiap jenis aktivitas (dipakai layar Aktivitas). */
export interface ActivityMeta {
  label: string;
  icon: IconName;
  tone: SemanticTone;
}

const ACTIVITY_META: Record<string, ActivityMeta> = {
  online_status: {
    label: 'Status siaga',
    icon: 'power-outline',
    tone: 'info',
  },
  order_accepted: {
    label: 'Order diterima',
    icon: 'checkmark-circle-outline',
    tone: 'success',
  },
  order_assigned: {
    label: 'Pengajuan ke client',
    icon: 'paper-plane-outline',
    tone: 'warning',
  },
  order_status: {
    label: 'Perbarui status order',
    icon: 'sync-outline',
    tone: 'info',
  },
  order_cancelled: {
    label: 'Order dibatalkan',
    icon: 'close-circle-outline',
    tone: 'danger',
  },
  order_arrived: {
    label: 'Tiba di lokasi client',
    icon: 'location-outline',
    tone: 'success',
  },
  quote_submitted: {
    label: 'Estimasi dikirim',
    icon: 'document-text-outline',
    tone: 'warning',
  },
  quote_withdrawn: {
    label: 'Estimasi ditarik',
    icon: 'create-outline',
    tone: 'neutral',
  },
  quote_addon_requested: {
    label: 'Biaya tambahan diajukan',
    icon: 'add-circle-outline',
    tone: 'warning',
  },
  quote_approved: {
    label: 'Estimasi disetujui',
    icon: 'checkmark-done-outline',
    tone: 'success',
  },
  quote_revision_requested: {
    label: 'Revisi estimasi diminta',
    icon: 'chatbox-ellipses-outline',
    tone: 'warning',
  },
  quote_callout_only: {
    label: 'Biaya panggil saja',
    icon: 'receipt-outline',
    tone: 'neutral',
  },
  invoice_sent: {
    label: 'Tagihan dikirim',
    icon: 'receipt-outline',
    tone: 'warning',
  },
  invoice_reopened: {
    label: 'Tagihan direvisi',
    icon: 'create-outline',
    tone: 'warning',
  },
  payment_received: {
    label: 'Pembayaran diterima',
    icon: 'cash-outline',
    tone: 'success',
  },
  cash_payment_confirmed: {
    label: 'Pembayaran tunai',
    icon: 'cash-outline',
    tone: 'success',
  },
  payment_method_selected: {
    label: 'Metode pembayaran',
    icon: 'card-outline',
    tone: 'info',
  },
  withdrawal: {
    label: 'Pencairan saldo',
    icon: 'wallet-outline',
    tone: 'info',
  },
  login: {
    label: 'Masuk aplikasi',
    icon: 'log-in-outline',
    tone: 'neutral',
  },
};

const FALLBACK_ACTIVITY: ActivityMeta = {
  label: 'Aktivitas',
  icon: 'pulse-outline',
  tone: 'neutral',
};

export function getActivityMeta(type: string): ActivityMeta {
  return ACTIVITY_META[type] ?? FALLBACK_ACTIVITY;
}

/** Aksi lanjutan yang bisa dilakukan montir untuk tiap status order. */
const NEXT_ACTION: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string; icon: IconName }>
> = {
  mechanic_accepted: { next: 'on_the_way', label: 'Mulai Perjalanan', icon: 'navigate-outline' },
  on_the_way: { next: 'arrived', label: 'Sampai di Lokasi', icon: 'location-outline' },
};

export function getNextAction(status: string) {
  return NEXT_ACTION[status as OrderStatus] ?? null;
}

/** Label progres dari sudut pandang montir (bukan client). */
const PROGRESS_LABEL: Record<string, string> = {
  mechanic_assigned: 'Menunggu konfirmasi client',
  mechanic_accepted: 'Kamu menerima order ini',
  on_the_way: 'Sedang menuju lokasi pelanggan',
  arrived: 'Tiba di lokasi — susun estimasi biaya',
  diagnosing: 'Sedang mendiagnosis kendaraan',
  repairing: 'Sedang memperbaiki kendaraan',
  completed: 'Pekerjaan selesai',
  payment: 'Menunggu pembayaran client',
  paid: 'Pembayaran lunas',
  cancelled: 'Order dibatalkan',
};

export function getMechanicProgressLabel(
  status: string,
  quoteStatus?: QuoteStatus | null,
): string {
  if (status === 'arrived') {
    if (quoteStatus === 'pending_approval') {
      return 'Menunggu persetujuan estimasi client';
    }
    if (quoteStatus === 'approved') {
      return 'Estimasi disetujui — lanjutkan pengerjaan';
    }
    if (quoteStatus === 'callout_only') {
      return 'Biaya panggil saja — lanjut ke pembayaran';
    }
    return 'Tiba di lokasi — susun estimasi biaya';
  }
  return PROGRESS_LABEL[status] ?? 'Order aktif';
}

/** Pilihan alasan saat montir membatalkan order aktif. */
export const MECHANIC_CANCEL_REASONS = [
  'Tidak bisa menjangkau lokasi',
  'Kendala kendaraan atau alat',
  'Client tidak bisa dihubungi',
  'Di luar kemampuan saya',
  'Client tidak merespons estimasi',
  'Lainnya',
] as const;

export interface QuoteQuickPickItem {
  label: string;
  amount: number;
  itemType: 'service' | 'parts';
}

/** Chip cepat untuk menyusun estimasi di pinggir jalan (bisa diubah nominalnya). */
export const MECHANIC_QUOTE_QUICK_PICKS: readonly QuoteQuickPickItem[] = [
  { label: 'Tambal Ban Tubeless', amount: 35000, itemType: 'service' },
  { label: 'Jumper Aki / Cek Kelistrikan', amount: 50000, itemType: 'service' },
  { label: 'Jasa Servis Ringan / Darurat', amount: 75000, itemType: 'service' },
  { label: 'Ganti Ban Dalam', amount: 65000, itemType: 'parts' },
  { label: 'Ganti Busi / Sekring', amount: 45000, itemType: 'parts' },
  { label: 'Oli Mesin Darurat', amount: 85000, itemType: 'parts' },
];
