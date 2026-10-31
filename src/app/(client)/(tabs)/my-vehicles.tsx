import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import {
  deleteVehicle,
  listMyVehicles,
  type ClientVehicle,
} from '@/features/client/service';
import { VehiclePhoto } from '@/features/vehicles/components/vehicle-photo';

const VEHICLE_LABEL: Record<ClientVehicle['type'], string> = {
  motor: 'Motor',
  mobil: 'Mobil',
  lainnya: 'Lainnya',
};

const VEHICLE_ICON: Record<ClientVehicle['type'], IconName> = {
  motor: 'bicycle-outline',
  mobil: 'car-outline',
  lainnya: 'cube-outline',
};

export default function MyVehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setVehicles(await listMyVehicles());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Muat ulang setiap layar difokuskan agar perubahan dari form langsung terlihat.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = (vehicle: ClientVehicle) => {
    Alert.alert(
      'Hapus kendaraan?',
      `${vehicle.brand} ${vehicle.model} (${vehicle.license_plate}) akan dihapus dari garasi.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicle(vehicle.id);
              await load();
            } catch (deleteError) {
              Alert.alert(
                'Gagal menghapus',
                deleteError instanceof Error ? deleteError.message : 'Coba lagi.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Garasi Saya"
        subtitle="Kendaraan yang tersimpan untuk pesanan cepat"
        showBack={false}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tambah kendaraan"
            hitSlop={8}
            onPress={() => router.push('/(client)/vehicles/new')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={20} color={Brand.white} />
          </Pressable>
        }
      />

      {loading ? (
        <LoadingState message="Memuat kendaraan..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Brand.primary}
              colors={[Brand.primary]}
            />
          }
        >
          {error ? (
            <ErrorState onRetry={load} />
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon="car-outline"
              message="Garasi masih kosong"
              hint="Simpan kendaraanmu agar pembuatan permintaan berikutnya lebih cepat."
              actionLabel="Tambah Kendaraan"
              onPressAction={() => router.push('/(client)/vehicles/new')}
            />
          ) : (
            vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ubah ${vehicle.brand} ${vehicle.model}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(client)/vehicles/new',
                      params: { id: vehicle.id },
                    })
                  }
                  style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
                >
                  {vehicle.photo_url ? (
                    <VehiclePhoto
                      value={vehicle.photo_url}
                      height={56}
                      style={styles.vehicleThumb}
                      emptyLabel={null}
                    />
                  ) : (
                    <View style={styles.iconBox}>
                      <Ionicons
                        name={VEHICLE_ICON[vehicle.type] ?? 'car-outline'}
                        size={22}
                        color={Brand.primary}
                      />
                    </View>
                  )}
                  <View style={styles.copy}>
                    <Text style={styles.name} numberOfLines={1}>
                      {vehicle.brand} {vehicle.model}
                    </Text>
                    <Text style={styles.meta}>
                      {VEHICLE_LABEL[vehicle.type]}
                      {vehicle.year ? ` • ${vehicle.year}` : ''}
                    </Text>
                    <View style={styles.plate}>
                      <Text style={styles.plateText}>{vehicle.license_plate}</Text>
                    </View>
                  </View>
                  <Ionicons name="create-outline" size={18} color={Brand.textMuted} />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Hapus ${vehicle.brand} ${vehicle.model}`}
                  hitSlop={8}
                  onPress={() => confirmDelete(vehicle)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={17} color={Brand.red} />
                </Pressable>
              </View>
            ))
          )}

          {vehicles.length > 0 ? (
            <Button
              label="Tambah Kendaraan"
              icon="add"
              variant="secondary"
              onPress={() => router.push('/(client)/vehicles/new')}
              style={styles.addFooter}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.md,
    marginBottom: Space.md,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: Space.md, flex: 1 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleThumb: { width: 64, borderRadius: Radius.md },
  copy: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: Brand.text },
  meta: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  plate: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: Brand.divider,
    marginTop: 6,
  },
  plateText: { fontSize: 10, fontWeight: '700', color: Brand.textSecondary, letterSpacing: 0.4 },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Brand.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.sm,
  },
  addFooter: { marginTop: Space.md },
  pressed: { opacity: 0.7 },
});
