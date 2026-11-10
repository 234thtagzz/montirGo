import type { IconName } from '@/components/ui/icon';

/** Dua fokus percakapan: diagnosis kerusakan dan tanya harga sparepart. */
export type AssistantMode = 'diagnose' | 'sparepart';

/** Siapa yang sedang memakai chat — memengaruhi gaya jawaban AI. */
export type AssistantPersona = 'client' | 'mechanic';

/** Pilihan kendaraan dari Garasi client untuk konteks harga/diagnosa. */
export interface AssistantVehicleOption {
  id: string;
  label: string;
}

export const AI_MODES: readonly {
  id: AssistantMode;
  label: string;
  icon: IconName;
}[] = [
  { id: 'diagnose', label: 'Diagnosa', icon: 'pulse-outline' },
  { id: 'sparepart', label: 'Harga Sparepart', icon: 'pricetag-outline' },
];

export const AI_SUGGESTIONS: Record<AssistantMode, string[]> = {
  diagnose: [
    'Motor mogok tidak bisa distarter',
    'Mobil overheat di jalan',
    'Rem bunyi saat direm',
    'Aki tekor, ciri-cirinya apa?',
  ],
  sparepart: [
    'Harga kampas rem depan Honda Beat 2020',
    'Harga oli mesin Toyota Avanza 2018',
    'Harga shockbreaker belakang motor matic',
    'Harga aki mobil 12V',
  ],
};

export const AI_DISCLAIMER: Record<AssistantMode, string> = {
  diagnose:
    'Asisten AI memberi indikasi awal, bukan diagnosis final. Montir tetap wajib pemeriksaan langsung (PRD §32).',
  sparepart:
    'Harga bersifat estimasi pasar, bukan penawaran resmi. Konfirmasi ke bengkel atau toko sparepart sebelum membeli.',
};

interface AssistantIntro {
  eyebrow: string;
  title: string;
  text: string;
}

/** Salinan kartu pembuka berbeda untuk client dan montir. */
export function getAssistantIntro(
  mode: AssistantMode,
  persona: AssistantPersona,
): AssistantIntro {
  if (mode === 'sparepart') {
    return persona === 'mechanic'
      ? {
          eyebrow: 'HARGA SPAREPART',
          title: 'Cek harga part sebelum menagih',
          text: 'Sebut kendaraan dan nama part. AI memberi rentang harga pasar, perkiraan harga modal, dan saran biaya jasa.',
        }
      : {
          eyebrow: 'HARGA SPAREPART',
          title: 'Tanya harga part sebelum bayar',
          text: 'Sebut kendaraan dan nama part. AI memberi rentang harga pasar plus estimasi biaya pasang.',
        };
  }

  return persona === 'mechanic'
    ? {
        eyebrow: 'ASISTEN DIAGNOSA',
        title: 'Tanya indikasi kerusakan',
        text: 'Deskripsikan gejala yang kamu temui di lokasi. Hasil AI adalah indikasi awal, bukan pengganti pemeriksaan langsung.',
      }
    : {
        eyebrow: 'ASISTEN KENDARAAN',
        title: 'Ceritakan keluhan kendaraanmu',
        text: 'Tulis gejala yang muncul. AI membantu menebak kemungkinan penyebab dan kisaran biaya perbaikan sebelum montir datang.',
      };
}

export function getAssistantSubtitle(persona: AssistantPersona): string {
  return persona === 'mechanic'
    ? 'Diagnosa kerusakan & harga sparepart'
    : 'Tanya kerusakan & harga sparepart';
}

export function getInputPlaceholder(mode: AssistantMode): string {
  return mode === 'sparepart'
    ? 'Tanya harga sparepart...'
    : 'Tanya soal kerusakan...';
}
