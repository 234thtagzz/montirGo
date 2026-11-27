import type { IconName } from '@/components/ui/icon';
import type { SemanticTone } from '@/theme';

export type CalloutTierSuggestion = 'motor' | 'mobil' | 'derek';

export interface ServiceCategory {
  key: string;
  label: string;
  description: string;
  icon: IconName;
  tone: SemanticTone;
  /** Tier biaya panggil default bila kategori dipilih. */
  defaultTier?: CalloutTierSuggestion;
  /** Teks awal yang diisikan ke form permintaan. */
  presetIssue?: string;
  /** Route khusus; jika kosong, membuka form permintaan dengan `?category=`. */
  route?: 'vehicles' | 'services';
}

/**
 * Kategori layanan MontirGo berbasis semantic tone (tanpa warna hex statis).
 * Setiap kategori darurat hanya melakukan prefill deskripsi dan tier saran.
 */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    key: 'ban',
    label: 'Ban Bocor',
    description: 'Ban bocor, kempes, atau roda bermasalah.',
    icon: 'disc-outline',
    tone: 'warning',
    presetIssue: 'Ban kendaraan bocor / kempes dan butuh bantuan di lokasi.',
  },
  {
    key: 'aki',
    label: 'Aki & Kelistrikan',
    description: 'Aki lemah, lampu mati, atau kendaraan tidak menyala.',
    icon: 'battery-charging-outline',
    tone: 'info',
    presetIssue: 'Aki lemah / kendaraan tidak mau menyala.',
  },
  {
    key: 'montir',
    label: 'Mogok / Mesin',
    description: 'Kendaraan bermasalah atau mogok di jalan.',
    icon: 'construct-outline',
    tone: 'emergency',
    presetIssue: 'Kendaraan saya bermasalah / mogok dan butuh bantuan montir di lokasi.',
  },
  {
    key: 'derek',
    label: 'Butuh Derek',
    description: 'Kendaraan tidak bisa jalan dan perlu diderek.',
    icon: 'car-sport-outline',
    tone: 'danger',
    defaultTier: 'derek',
    presetIssue: 'Kendaraan tidak bisa dikendarai dan butuh derek/towing.',
  },
  {
    key: 'bensin',
    label: 'Bensin Darurat',
    description: 'Kehabisan bahan bakar di perjalanan.',
    icon: 'speedometer-outline',
    tone: 'warning',
    presetIssue: 'Kendaraan kehabisan bahan bakar dan butuh bantuan.',
  },
  {
    key: 'servis',
    label: 'Servis Ringan',
    description: 'Servis rutin atau pengecekan kondisi kendaraan.',
    icon: 'settings-outline',
    tone: 'success',
    presetIssue: 'Saya ingin servis ringan / pengecekan kondisi kendaraan.',
  },
  {
    key: 'kendaraan',
    label: 'Kendaraan Saya',
    description: 'Kelola data kendaraan yang tersimpan.',
    icon: 'car-outline',
    tone: 'neutral',
    route: 'vehicles',
  },
  {
    key: 'semua',
    label: 'Semua Layanan',
    description: 'Lihat seluruh layanan MontirGo.',
    icon: 'grid-outline',
    tone: 'info',
    route: 'services',
  },
];

const TRIAGE_KEYS = ['ban', 'aki', 'montir', 'derek', 'bensin', 'servis'] as const;

/** 6 kategori utama untuk Grid Triase Visual 2x3 di Beranda Client. */
export const TRIAGE_CATEGORIES: ServiceCategory[] = TRIAGE_KEYS.map((key) =>
  SERVICE_CATEGORIES.find((item) => item.key === key),
).filter((item): item is ServiceCategory => Boolean(item));

export function getCategory(key: string | undefined): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((category) => category.key === key);
}
