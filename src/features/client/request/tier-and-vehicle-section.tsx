import { ActivityIndicator, Pressable, View } from 'react-native';
import { Chip } from '@/components/ui/chip';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import {
  getCalloutFeeAmountForTier,
  type CalloutFeeTier,
  type ClientVehicle,
  type PlatformPricingAndSupport,
} from '@/features/client/service';
import { PRESET_CATEGORIES } from '@/features/client/request/use-new-request';
import { VehicleProfileCard } from '@/features/vehicles/components/vehicle-profile-card';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

const TIER_OPTIONS: {
  key: CalloutFeeTier;
  label: string;
  icon: IconName;
  hint: string;
}[] = [
  { key: 'motor', label: 'Motor', icon: 'bicycle-outline', hint: 'Roda 2' },
  { key: 'mobil', label: 'Mobil', icon: 'car-outline', hint: 'Roda 4' },
  { key: 'derek', label: 'Derek', icon: 'car-sport-outline', hint: 'Towing' },
];

interface TierAndVehicleSectionProps {
  calloutTier: CalloutFeeTier;
  pricing: PlatformPricingAndSupport;
  categoryKey: string;
  vehicles: ClientVehicle[];
  vehicleId: string | null;
  selectedVehicle: ClientVehicle | null;
  photoBusy: boolean;
  onSelectTier: (tier: CalloutFeeTier) => void;
  onSelectCategory: (key: string) => void;
  onSelectVehicle: (id: string | null) => void;
  onAttachVehiclePhoto: () => void;
  onAddVehicle: () => void;
}

export function TierAndVehicleSection({
  calloutTier,
  pricing,
  categoryKey,
  vehicles,
  vehicleId,
  selectedVehicle,
  photoBusy,
  onSelectTier,
  onSelectCategory,
  onSelectVehicle,
  onAttachVehiclePhoto,
  onAddVehicle,
}: TierAndVehicleSectionProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <View style={styles.block}>
        <AppText variant="label">1. Pilih jenis kendaraan / derek</AppText>
        <AppText variant="caption" tone="muted">
          Menentukan Biaya Panggil Pasti (1 ketukan).
        </AppText>
        <View style={styles.tierRow}>
          {TIER_OPTIONS.map((item) => {
            const active = item.key === calloutTier;
            const tariff = getCalloutFeeAmountForTier(pricing, item.key);
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item.label}, biaya panggil ${formatIDR(tariff)}`}
                onPress={() => onSelectTier(item.key)}
                style={({ pressed }) => [
                  styles.tierPill,
                  active && styles.tierPillActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={
                    active
                      ? theme.colors.actionPrimaryAltBg
                      : theme.colors.textSecondary
                  }
                />
                <AppText
                  variant="label"
                  tone={active ? 'info' : 'primary'}
                >
                  {item.label}
                </AppText>
                <AppText
                  variant="caption"
                  tone={active ? 'info' : 'muted'}
                  style={theme.tabularNums}
                >
                  {formatIDR(tariff)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <AppText variant="label">2. Kategori keluhan</AppText>
        <View style={styles.chipsWrap}>
          {PRESET_CATEGORIES.map((category) => (
            <Chip
              key={category.key}
              label={category.label}
              icon={category.icon}
              tone={category.tone}
              selected={category.key === categoryKey}
              onPress={() => onSelectCategory(category.key)}
            />
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <AppText variant="label">Kendaraan dari garasi (opsional)</AppText>
        {vehicles.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAddVehicle}
            style={({ pressed }) => [styles.emptyVehicle, pressed && styles.pressed]}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.colors.statusInfoFg} />
            <AppText variant="body" tone="info" style={styles.flexCopy}>
              Simpan kendaraan di Garasi (opsional)
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.chipsWrap}>
            <Chip
              label="Tanpa kendaraan"
              selected={vehicleId === null}
              onPress={() => onSelectVehicle(null)}
            />
            {vehicles.map((vehicle) => (
              <Chip
                key={vehicle.id}
                label={`${vehicle.brand} ${vehicle.model} · ${vehicle.license_plate}`}
                selected={vehicleId === vehicle.id}
                onPress={() => onSelectVehicle(vehicle.id)}
              />
            ))}
          </View>
        )}

        {selectedVehicle ? (
          <View style={styles.vehiclePreview}>
            <VehicleProfileCard
              variant="compact"
              photo={selectedVehicle.photo_url}
              type={selectedVehicle.type}
              brand={selectedVehicle.brand}
              model={selectedVehicle.model}
              year={selectedVehicle.year}
              plate={selectedVehicle.license_plate}
              notes={selectedVehicle.notes}
              footer={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedVehicle.photo_url
                      ? 'Ganti foto kendaraan'
                      : 'Tambah foto kendaraan'
                  }
                  disabled={photoBusy}
                  onPress={onAttachVehiclePhoto}
                  style={({ pressed }) => [
                    styles.photoButton,
                    pressed && styles.pressed,
                    photoBusy && styles.photoButtonDisabled,
                  ]}
                >
                  {photoBusy ? (
                    <ActivityIndicator size="small" color={theme.colors.statusInfoFg} />
                  ) : (
                    <Ionicons name="camera-outline" size={15} color={theme.colors.statusInfoFg} />
                  )}
                  <AppText variant="caption" tone="info">
                    {photoBusy
                      ? 'Mengunggah foto…'
                      : selectedVehicle.photo_url
                        ? 'Ganti foto kendaraan'
                        : 'Tambah foto kendaraan'}
                  </AppText>
                </Pressable>
              }
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  section: {
    gap: theme.spacing.lg,
  },
  block: {
    gap: theme.spacing.xs,
  },
  tierRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xxs,
  },
  tierPill: {
    flex: 1,
    minHeight: 74,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xxs,
  },
  tierPillActive: {
    backgroundColor: theme.colors.statusInfoBg,
    borderColor: theme.colors.borderFocus,
  },
  chipsWrap: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xxs,
  },
  emptyVehicle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    minHeight: theme.touchTarget.min,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: theme.colors.statusInfoBorder,
    backgroundColor: theme.colors.bgSurface,
    marginTop: theme.spacing.xxs,
  },
  flexCopy: { flex: 1 },
  vehiclePreview: {
    marginTop: theme.spacing.sm,
  },
  photoButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    alignSelf: 'flex-start' as const,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    minHeight: 34,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.statusInfoBg,
  },
  photoButtonDisabled: { opacity: 0.65 },
  pressed: { opacity: 0.78 },
});
