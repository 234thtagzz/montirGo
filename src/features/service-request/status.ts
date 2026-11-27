import type { IconName } from '@/components/ui/icon';
import type { SemanticTone } from '@/theme';

export type OrderStatus =
  | 'requested'
  | 'mechanic_assigned'
  | 'mechanic_accepted'
  | 'on_the_way'
  | 'arrived'
  | 'payment'
  | 'paid'
  | 'cancelled';

export type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'callout_only';

export interface StatusMeta {
  label: string;
  shortLabel: string;
  tone: SemanticTone;
  icon: IconName;
  /** Langkah 1-6 pada indikator progres; 0 untuk status batal. */
  step: number;
}

export interface QuoteStatusMeta {
  label: string;
  shortLabel: string;
  tone: SemanticTone;
  icon: IconName;
}

/** Jumlah langkah pada indikator progres order. */
export const TOTAL_STEPS = 6;

const META: Record<OrderStatus, StatusMeta> = {
  requested: {
    label: 'Mencari montir',
    shortLabel: 'Mencari montir',
    tone: 'warning',
    icon: 'search-outline',
    step: 1,
  },
  mechanic_assigned: {
    label: 'Menunggu konfirmasi',
    shortLabel: 'Menunggu konfirmasi',
    tone: 'warning',
    icon: 'time-outline',
    step: 2,
  },
  mechanic_accepted: {
    label: 'Montir menerima pesanan',
    shortLabel: 'Diterima montir',
    tone: 'info',
    icon: 'checkmark-circle-outline',
    step: 2,
  },
  on_the_way: {
    label: 'Montir menuju lokasimu',
    shortLabel: 'Menuju lokasi',
    tone: 'info',
    icon: 'navigate-outline',
    step: 3,
  },
  arrived: {
    label: 'Montir tiba di lokasi',
    shortLabel: 'Montir tiba',
    tone: 'info',
    icon: 'location-outline',
    step: 4,
  },
  payment: {
    label: 'Menunggu pembayaran',
    shortLabel: 'Pembayaran',
    tone: 'warning',
    icon: 'wallet-outline',
    step: 5,
  },
  paid: {
    label: 'Pembayaran lunas',
    shortLabel: 'Lunas',
    tone: 'success',
    icon: 'shield-checkmark-outline',
    step: 6,
  },
  cancelled: {
    label: 'Pesanan dibatalkan',
    shortLabel: 'Dibatalkan',
    tone: 'danger',
    icon: 'close-circle-outline',
    step: 0,
  },
};

const QUOTE_META: Record<QuoteStatus, QuoteStatusMeta> = {
  draft: {
    label: 'Montir menyusun estimasi',
    shortLabel: 'Menyusun estimasi',
    tone: 'neutral',
    icon: 'document-text-outline',
  },
  pending_approval: {
    label: 'Menunggu persetujuan estimasi',
    shortLabel: 'Menunggu persetujuan',
    tone: 'warning',
    icon: 'time-outline',
  },
  approved: {
    label: 'Estimasi disetujui client',
    shortLabel: 'Estimasi disetujui',
    tone: 'success',
    icon: 'checkmark-circle-outline',
  },
  callout_only: {
    label: 'Biaya panggil saja',
    shortLabel: 'Biaya panggil saja',
    tone: 'neutral',
    icon: 'receipt-outline',
  },
};

export function getStatusMeta(status: string): StatusMeta {
  return META[status as OrderStatus] ?? META.requested;
}

export function getQuoteStatusMeta(quoteStatus: string | null | undefined): QuoteStatusMeta {
  return QUOTE_META[quoteStatus as QuoteStatus] ?? QUOTE_META.draft;
}

export function isActiveStatus(status: string): boolean {
  return status !== 'paid' && status !== 'cancelled';
}

/** Client boleh membatalkan pesanan hingga sebelum montir tiba di lokasi (`arrived`). */
export function isCancellable(status: string): boolean {
  return (
    status === 'requested' ||
    status === 'mechanic_assigned' ||
    status === 'mechanic_accepted' ||
    status === 'on_the_way'
  );
}

/** Label progres singkat untuk kartu pesanan aktif. */
export function getProgressLabel(status: string): string {
  const step = getStatusMeta(status).step;
  if (step === 0) return 'Pesanan dibatalkan';
  if (step === 1) return 'Mencari montir terdekat';
  if (status === 'mechanic_assigned') return 'Menunggu konfirmasimu';
  if (step === 2) return 'Montir menerima pesananmu';
  if (step === 3) return 'Montir sedang menuju lokasi';
  if (step === 4) return 'Montir sudah tiba di lokasi';
  if (step === 5) return 'Menunggu pembayaran';
  return 'Pembayaran lunas';
}
