// Label & ikon jenis kendaraan yang dipakai bersama oleh section client dan montir.
import type { IconName } from '@/components/ui/icon';
import type { SemanticTone } from '@/theme';

export type VehicleTypeValue = 'motor' | 'mobil' | 'lainnya';

export interface VehicleTypeMeta {
  label: string;
  icon: IconName;
  tone: SemanticTone;
}

export const VEHICLE_TYPE_META: Record<VehicleTypeValue, VehicleTypeMeta> = {
  motor: {
    label: 'Motor',
    icon: 'bicycle-outline',
    tone: 'info',
  },
  mobil: {
    label: 'Mobil',
    icon: 'car-outline',
    tone: 'success',
  },
  lainnya: {
    label: 'Lainnya',
    icon: 'cube-outline',
    tone: 'warning',
  },
};

export const VEHICLE_TYPE_OPTIONS: { key: VehicleTypeValue; label: string }[] = [
  { key: 'motor', label: 'Motor' },
  { key: 'mobil', label: 'Mobil' },
  { key: 'lainnya', label: 'Lainnya' },
];

export function getVehicleTypeMeta(type: string | null | undefined): VehicleTypeMeta {
  return VEHICLE_TYPE_META[type as VehicleTypeValue] ?? VEHICLE_TYPE_META.lainnya;
}

/** Contoh: "Honda Vario 125 (2020)". */
export function formatVehicleName(
  brand: string | null | undefined,
  model: string | null | undefined,
  year?: number | null,
): string {
  const name = [brand, model]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return year ? `${name} (${year})`.trim() : name;
}

/** Contoh: "Motor · Honda Vario 125". Kosong bila kendaraan tidak dicantumkan. */
export function formatVehicleLabel(
  type: string | null | undefined,
  brand: string | null | undefined,
  model: string | null | undefined,
): string {
  const name = formatVehicleName(brand, model);
  if (!type && !name) return '';
  return [type ? getVehicleTypeMeta(type).label : '', name].filter(Boolean).join(' · ');
}
