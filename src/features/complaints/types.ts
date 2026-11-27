// Tipe data Keluhan (complaints).
import type { IconName } from '@/components/ui/icon';
import type { SemanticTone } from '@/theme';

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
  tone: SemanticTone;
  icon: IconName;
}

/** Opsi kategori keluhan — dipakai di form dan badge. */
export const COMPLAINT_CATEGORY_META: Record<ComplaintCategory, { label: string; icon: IconName }> =
  {
    pesanan: { label: 'Pesanan', icon: 'receipt-outline' },
    pembayaran: { label: 'Pembayaran', icon: 'cash-outline' },
    montir: { label: 'Montir & teknisi', icon: 'construct-outline' },
    aplikasi: { label: 'Aplikasi', icon: 'chatbubble-outline' },
    lainnya: { label: 'Lainnya', icon: 'help-circle-outline' },
  };

export const COMPLAINT_STATUS_META: Record<ComplaintStatus, ComplaintStatusMeta> = {
  open: { label: 'Terbuka', tone: 'warning', icon: 'alert-circle-outline' },
  in_progress: { label: 'Diproses', tone: 'info', icon: 'construct-outline' },
  resolved: { label: 'Diselesaikan', tone: 'success', icon: 'checkmark-circle-outline' },
  closed: { label: 'Ditutup', tone: 'neutral', icon: 'archive-outline' },
};
