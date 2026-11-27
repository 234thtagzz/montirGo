import { Pressable, ScrollView, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import type { ClientVehicle } from '@/features/client/types';
import { VehiclePhoto } from '@/features/vehicles/components/vehicle-photo';
import { getVehicleTypeMeta } from '@/features/vehicles/constants';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

const VEHICLE_ICON: Record<ClientVehicle['type'], IconName> = {
  motor: 'bicycle-outline',
  mobil: 'car-outline',
  lainnya: 'cube-outline',
};

interface VehicleStripProps {
  vehicles: ClientVehicle[];
  onPressVehicle: (vehicle: ClientVehicle) => void;
  onPressAdd: () => void;
  onPressManage: () => void;
}

export function VehicleStrip({
  vehicles,
  onPressVehicle,
  onPressAdd,
  onPressManage,
}: VehicleStripProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {vehicles.map((vehicle) => {
        const typeMeta = getVehicleTypeMeta(vehicle.type);
        const typeTone = theme.tones[typeMeta.tone];
        return (
          <Pressable
            key={vehicle.id}
            accessibilityRole="button"
            accessibilityLabel={`Pesan montir untuk ${vehicle.brand} ${vehicle.model}`}
            onPress={() => onPressVehicle(vehicle)}
            style={({ pressed }) => [styles.card, theme.elevation.card, pressed && styles.pressed]}
          >
            <View style={styles.media}>
              {vehicle.photo_url ? (
                <VehiclePhoto value={vehicle.photo_url} height={74} emptyLabel={null} />
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: typeTone.bg }]}>
                  <Ionicons
                    name={VEHICLE_ICON[vehicle.type] ?? 'car-outline'}
                    size={22}
                    color={typeTone.fg}
                  />
                </View>
              )}
              <View style={styles.mediaTagWrap}>
                <Badge label={typeMeta.label} tone={typeMeta.tone} size="sm" />
              </View>
            </View>

            <AppText variant="label" numberOfLines={1} style={styles.brand}>
              {vehicle.brand} {vehicle.model}
            </AppText>
            <View style={styles.bottomRow}>
              <View style={styles.plate}>
                <AppText variant="caption" tone="secondary" style={styles.plateText}>
                  {vehicle.license_plate}
                </AppText>
              </View>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.actionPrimaryAltBg} />
            </View>
          </Pressable>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tambah kendaraan"
        onPress={onPressAdd}
        style={({ pressed }) => [styles.addCard, pressed && styles.pressed]}
      >
        <View style={styles.addIcon}>
          <Ionicons name="add" size={20} color={theme.colors.statusInfoFg} />
        </View>
        <AppText variant="label" tone="info">
          Tambah
        </AppText>
        <AppText variant="caption" tone="secondary">
          Kendaraan
        </AppText>
      </Pressable>

      {vehicles.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kelola kendaraan"
          onPress={onPressManage}
          style={({ pressed }) => [styles.manageCard, pressed && styles.pressed]}
        >
          <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
          <AppText variant="caption" tone="secondary">
            Kelola
          </AppText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) => ({
  row: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xs,
  },
  card: {
    width: 164,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.sm,
  },
  pressed: { opacity: 0.78 },
  media: {
    borderRadius: theme.radii.md,
    overflow: 'hidden' as const,
  },
  iconWrap: {
    height: 74,
    borderRadius: theme.radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mediaTagWrap: {
    position: 'absolute' as const,
    top: 6,
    left: 6,
  },
  brand: {
    marginTop: theme.spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: theme.spacing.xs,
  },
  plate: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  plateText: {
    fontFamily: theme.fontFamily.bold,
    letterSpacing: 0.4,
  },
  addCard: {
    width: 112,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: theme.colors.statusInfoBorder,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: theme.spacing.md,
    gap: theme.spacing.xxs,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.xxs,
  },
  manageCard: {
    width: 84,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
});
