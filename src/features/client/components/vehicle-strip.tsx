import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
import type { ClientVehicle } from '@/features/client/types';
import { VehiclePhoto } from '@/features/vehicles/components/vehicle-photo';

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
          {vehicle.photo_url ? (
            <VehiclePhoto
              value={vehicle.photo_url}
              height={72}
              emptyLabel={null}
            />
          ) : (
            <View style={styles.iconBox}>
              <Ionicons
                name={VEHICLE_ICON[vehicle.type] ?? 'car-outline'}
                size={20}
                color={Brand.primary}
              />
            </View>
          )}
          <Text style={styles.brand} numberOfLines={1}>
            {vehicle.brand} {vehicle.model}
          </Text>
          <View style={styles.plate}>
            <Text style={styles.plateText}>{vehicle.license_plate}</Text>
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
          <Ionicons name="settings-outline" size={20} color={Brand.textSecondary} />
          <Text style={styles.manageText}>Kelola</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Space.md, paddingRight: Space.xs },
  card: {
    width: 148,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.md,
  },
  pressed: { opacity: 0.7 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: 12.5, fontWeight: '600', color: Brand.text, marginTop: Space.sm },
  plate: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: Brand.divider,
    marginTop: 6,
  },
  plateText: { fontSize: 10, fontWeight: '700', color: Brand.textSecondary, letterSpacing: 0.4 },
  addCard: {
    width: 104,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.primaryBorder,
    backgroundColor: '#FAFCFF',
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
    width: 76,
    borderRadius: Radius.lg,
    backgroundColor: Brand.divider,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: Space.md,
  },
  manageText: { fontSize: 11, fontWeight: '600', color: Brand.textSecondary },
});
