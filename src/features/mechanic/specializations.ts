// Pilihan spesialisasi kendaraan montir.
//
// Dipakai bersama oleh form profil montir (pilihan ganda) dan direktori montir
// di Beranda client agar labelnya konsisten. Dipisah dari `constants.ts` karena
// file itu khusus meta aktivitas & progres order montir.
//
// Tersimpan di `mechanic_profiles.vehicle_specialization` sebagai `text[]`.
import type { IconName } from '@/components/ui/icon';

export interface VehicleSpecializationOption {
  /** Nilai yang disimpan di database. */
  value: string;
  label: string;
  icon: IconName;
}

export const VEHICLE_SPECIALIZATION_OPTIONS: VehicleSpecializationOption[] = [
  { value: 'motor_matic', label: 'Motor Matic', icon: 'speedometer-outline' },
  { value: 'motor_manual', label: 'Motor Manual', icon: 'speedometer-outline' },
  { value: 'motor_listrik', label: 'Motor Listrik', icon: 'flash-outline' },
  { value: 'sepeda', label: 'Sepeda', icon: 'bicycle-outline' },
  { value: 'mobil_bensin', label: 'Mobil Bensin', icon: 'car-outline' },
  { value: 'mobil_diesel', label: 'Mobil Diesel', icon: 'car-outline' },
  { value: 'mobil_listrik', label: 'Mobil Listrik', icon: 'flash-outline' },
  { value: 'truk', label: 'Truk', icon: 'bus-outline' },
  { value: 'bus', label: 'Bus', icon: 'bus-outline' },
  { value: 'lainnya', label: 'Lainnya', icon: 'cube-outline' },
];

const LABEL_BY_VALUE = new Map(
  VEHICLE_SPECIALIZATION_OPTIONS.map((option) => [option.value, option.label]),
);

/** Label ramah dibaca. Nilai lama yang belum terdaftar ditampilkan apa adanya. */
export function getSpecializationLabel(value: string): string {
  const trimmed = value.trim();
  return LABEL_BY_VALUE.get(trimmed) ?? trimmed.replace(/_/g, ' ');
}

/** Contoh: "Motor Matic · Mobil Bensin". */
export function formatSpecializations(values: string[] | null | undefined): string {
  return (values ?? []).filter(Boolean).map(getSpecializationLabel).join(' · ');
}
