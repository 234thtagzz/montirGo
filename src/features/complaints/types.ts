// Tipo data Keluhan (complaints).
import type { IconName } from '@/components/ui/icon';

export type ComplaintCategory = 'pesanan' | 'pembayaran' | 'montir' | 'aplikasi' | 'lainnya';
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Complaint {
  id: string;
  reporter_id: string;
  reporter_role: string;
  category: ComplaintCategory;
  subject: string;
  description: string;
  /** Path objek di bucket privat `complaint-photos`. */
  photo_paths: string[];
  status: ComplaintStatus;
  admin_reply: string | null;
  resolved_at: string | null;
  request_id: string;
  created_at: string;
  updated_at: string;
}

export interface ComplaintFormDraft {
  category: ComplaintCategory;
  requestId: string;
  subject: string;
  description: string;
  photos: { uri: string; mimeType: string }[];
}

export interface TransactionSummary {
  id: string;
  status: string;
  issue_description: string;
  created_at: string;
}

export interface ComplaintStatusMeta {
  label: string;
  color: string;
  background: string;
  icon: IconName;
}

/** Opsi kategori keluahan — dipakai di form dan badge berikut semuanya. */
export const COMPLAINT_CATEGORY_META: Record<ComplaintCategory, { label: string; icon: IconName }> =
  {
    pesanan: { label: 'Pesanan', icon: 'receipt-outline' },
    pembayaran: { label: 'Pembayaran', icon: 'cash-outline' },
    montir: { label: 'Montir & teknisi', icon: 'construct-outline' },
    aplikasi: { label: 'Aplikasi', icon: 'chatbubble-outline' },
    lainnya: { label: 'Lainnya', icon: 'help-circle-outline' },
  };

export const COMPLAINT_STATUS_META: Record<ComplaintStatus, ComplaintStatusMeta> = {
  open: { label: 'Terbuka', color: '#B45309', background: '#FEF3C7', icon: 'alert-circle-outline' },
  in_progress: {
    label: 'Diproses',
    color: '#0847C4',
    background: '#EBF1FF',
    icon: 'construct-outline',
  },
  resolved: {
    label: 'Diselesaikan',
    color: '#0E9F6E',
    background: '#E7F8F1',
    icon: 'checkmark-circle-outline',
  },
  closed: { label: 'Ditutup', color: '#8A94A6', background: '#F7F9FC', icon: 'archive-outline' },
};
