import type { IconName } from '@/components/ui/icon';

export interface ServiceCategory {
  key: string;
  label: string;
  description: string;
  icon: IconName;
  color: string;
  background: string;
  /** Teks awal yang diisikan ke form permintaan. */
  presetIssue?: string;
  /** Route khusus; jika kosong, membuka form permintaan dengan `?category=`. */
  route?: 'vehicles' | 'services';
}

/**
 * Kategori layanan di Beranda. Setiap kategori darurat hanya melakukan
 * prefill deskripsi pada form permintaan — tidak membuat backend baru.
 */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    key: 'montir',
    label: 'Butuh Montir',
    description: 'Montir datang langsung ke lokasimu.',
    icon: 'construct-outline',
    color: '#0B74E5',
    background: '#E8F1FF',
    presetIssue: 'Kendaraan saya bermasalah dan butuh bantuan montir di lokasi.',
  },
  {
    key: 'aki',
    label: 'Aki & Kelistrikan',
    description: 'Aki lemah, lampu mati, atau kendaraan tidak mau menyala.',
    icon: 'battery-charging-outline',
    color: '#B45309',
    background: '#FEF3C7',
    presetIssue: 'Aki lemah / kendaraan tidak mau menyala.',
  },
  {
    key: 'ban',
    label: 'Ban & Roda',
    description: 'Ban bocor, kempes, atau roda bermasalah.',
    icon: 'disc-outline',
    color: '#0891B2',
    background: '#E0F7FA',
    presetIssue: 'Ban kendaraan bocor / kempes dan butuh bantuan di lokasi.',
  },
  {
    key: 'derek',
    label: 'Derek & Towing',
    description: 'Kendaraan tidak bisa dikendarai dan perlu diderek.',
    icon: 'car-sport-outline',
    color: '#7C3AED',
    background: '#F1EAFE',
    presetIssue: 'Kendaraan tidak bisa dikendarai dan butuh derek/towing.',
  },
  {
    key: 'bensin',
    label: 'Bensin Darurat',
    description: 'Kehabisan bahan bakar di perjalanan.',
    icon: 'speedometer-outline',
    color: '#DC2626',
    background: '#FEE2E2',
    presetIssue: 'Kendaraan kehabisan bahan bakar dan butuh bantuan.',
  },
  {
    key: 'servis',
    label: 'Servis Ringan',
    description: 'Servis rutin atau pengecekan kondisi kendaraan.',
    icon: 'settings-outline',
    color: '#059669',
    background: '#E6F7EE',
    presetIssue: 'Saya ingin servis ringan / pengecekan kondisi kendaraan.',
  },
  {
    key: 'kendaraan',
    label: 'Kendaraan Saya',
    description: 'Kelola data kendaraan yang tersimpan.',
    icon: 'car-outline',
    color: '#334155',
    background: '#EEF2F7',
    route: 'vehicles',
  },
  {
    key: 'semua',
    label: 'Semua Layanan',
    description: 'Lihat seluruh layanan MontirGo.',
    icon: 'grid-outline',
    color: '#0B74E5',
    background: '#E8F1FF',
    route: 'services',
  },
];

export function getCategory(key: string | undefined): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((category) => category.key === key);
}
