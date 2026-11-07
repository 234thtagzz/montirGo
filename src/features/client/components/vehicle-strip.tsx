import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import type { ClientVehicle } from '@/features/client/types';
import { VehiclePhoto } from '@/features/vehicles/components/vehicle-photo';

const VEHICLE_ICON: Record<ClientVehicle['type'], IconName> = {
  motor: 'bicycle-outline',
  mobil: 'car-outline',
  lainnya: 'cube-outline',
};

const VEHICLE_LABEL: Record<ClientVehicle['type'], string> = {
  motor: 'Motor',
  mobil: 'Mobil',
  lainnya: 'Lainnya',
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {vehicles.map((vehicle) => (
        <Pressable
          key={vehicle.id}
          accessibilityRole="button"
          accessibilityLabel={`Pesan montir untuk ${vehicle.brand} ${vehicle.model}`}
          onPress={() => onPressVehicle(vehicle)}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.media}>
            {vehicle.photo_url ? (
              <VehiclePhoto value={vehicle.photo_url} height={74} emptyLabel={null} />
            ) : (
              <View style={styles.iconWrap}>
                <Ionicons
                  name={VEHICLE_ICON[vehicle.type] ?? 'car-outline'}
                  size={22}
                  color={Brand.primary}
                />
              </View>
            )}
            <View style={styles.mediaTag}>
              <Text style={styles.mediaTagText}>{VEHICLE_LABEL[vehicle.type]}</Text>
            </View>
          </View>

          <Text style={styles.brand} numberOfLines={1}>
            {vehicle.brand} {vehicle.model}
          </Text>
          <View style={styles.bottomRow}>
            <View style={styles.plate}>
              <Text style={styles.plateText}>{vehicle.license_plate}</Text>
            </View>
            <Ionicons name="arrow-forward" size={13} color={Brand.primary} />
          </View>
        </Pressable>
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tambah kendaraan"
        onPress={onPressAdd}
        style={({ pressed }) => [styles.addCard, pressed && styles.pressed]}
      >
        <View style={styles.addIcon}>
          <Ionicons name="add" size={20} color={Brand.primary} />
        </View>
        <Text style={styles.addTitle}>Tambah</Text>
        <Text style={styles.addHint}>Kendaraan</Text>
      </Pressable>

      {vehicles.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kelola kendaraan"
          onPress={onPressManage}
          style={({ pressed }) => [styles.manageCard, pressed && styles.pressed]}
        >
          <Ionicons name="settings-outline" size={19} color={Brand.textSecondary} />
          <Text style={styles.manageText}>Kelola</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Space.md, paddingRight: Space.xs },
  card: {
    width: 156,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.sm,
  },
  pressed: { opacity: 0.72 },
  media: { borderRadius: Radius.md, overflow: 'hidden' },
  iconWrap: {
    height: 74,
    borderRadius: Radius.md,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    backgroundColor: 'rgba(11,18,32,0.72)',
  },
  mediaTagText: { fontSize: 8.5, fontWeight: '700', color: Brand.white, letterSpacing: 0.3 },
  brand: { ...Type.label, color: Brand.text, fontWeight: '700', marginTop: Space.sm },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  plate: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: Brand.divider,
  },
  plateText: { fontSize: 9.5, fontWeight: '700', color: Brand.textSecondary, letterSpacing: 0.4 },
  addCard: {
    width: 106,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Brand.primaryBorder,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.md,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTitle: { fontSize: 12.5, fontWeight: '700', color: Brand.primary, marginTop: 6 },
  addHint: { fontSize: 10.5, color: Brand.textSecondary },
  manageCard: {
    width: 78,
    borderRadius: Radius.lg,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Space.md,
  },
  manageText: { fontSize: 11, fontWeight: '600', color: Brand.textSecondary },
});
