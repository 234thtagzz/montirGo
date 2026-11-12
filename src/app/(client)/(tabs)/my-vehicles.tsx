import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Ionicons, type IconName } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { Brand, Radius, ScreenPadding, Space, Type } from "@/constants/brand";
import {
  deleteVehicle,
  listMyVehicles,
  type ClientVehicle,
} from "@/features/client/service";
import { VehiclePhoto } from "@/features/vehicles/components/vehicle-photo";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const VEHICLE_LABEL: Record<ClientVehicle["type"], string> = {
  motor: "Motor",
  mobil: "Mobil",
  lainnya: "Lainnya",
};

const VEHICLE_ICON: Record<ClientVehicle["type"], IconName> = {
  motor: "bicycle-outline",
  mobil: "car-outline",
  lainnya: "cube-outline",
};

export default function MyVehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClientVehicle | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

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

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteVehicle(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (deleteError) {
      Alert.alert(
        "Gagal menghapus",
        deleteError instanceof Error ? deleteError.message : "Coba lagi.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Garasi"
        subtitle="Kendaraan yang tersimpan"
        showBack={false}
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
              onPressAction={() => router.push("/(client)/vehicles/new")}
            />
          ) : (
            <>
              <View style={styles.summary}>
                <View style={styles.summaryIcon}>
                  <Ionicons
                    name="car-sport-outline"
                    size={17}
                    color={Brand.primary}
                  />
                </View>
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryTitle}>
                    {vehicles.length} kendaraan tersimpan
                  </Text>
                  <Text style={styles.summaryText}>
                    Pilih kendaraan saat membuat permintaan agar montir lebih
                    siap.
                  </Text>
                </View>
              </View>

              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>Daftar kendaraan</Text>
                <View style={styles.sectionLine} />
              </View>

              {vehicles.map((vehicle) => (
                <View key={vehicle.id} style={styles.card}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Ubah ${vehicle.brand} ${vehicle.model}`}
                    onPress={() =>
                      router.push({
                        pathname: "/(client)/vehicles/new",
                        params: { id: vehicle.id },
                      })
                    }
                    style={({ pressed }) => [
                      styles.cardMain,
                      pressed && styles.pressed,
                    ]}
                  >
                    {vehicle.photo_url ? (
                      <VehiclePhoto
                        value={vehicle.photo_url}
                        height={58}
                        style={styles.vehicleThumb}
                        emptyLabel={null}
                      />
                    ) : (
                      <View style={styles.iconBox}>
                        <Ionicons
                          name={VEHICLE_ICON[vehicle.type] ?? "car-outline"}
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
                        {vehicle.year ? ` · ${vehicle.year}` : ""}
                      </Text>
                      <View style={styles.plate}>
                        <Text style={styles.plateText}>
                          {vehicle.license_plate}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name="create-outline"
                      size={17}
                      color={Brand.textMuted}
                    />
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus ${vehicle.brand} ${vehicle.model}`}
                    hitSlop={8}
                    onPress={() => setPendingDelete(vehicle)}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={Brand.red}
                    />
                  </Pressable>
                </View>
              ))}

              <Button
                label="Tambah Kendaraan"
                icon="add"
                onPress={() => router.push("/(client)/vehicles/new")}
                style={styles.primary}
              />
            </>
          )}
        </ScrollView>
      )}

      <ConfirmSheet
        visible={pendingDelete !== null}
        destructive
        loading={deleting}
        icon="trash-outline"
        title="Hapus kendaraan?"
        message={
          pendingDelete
            ? `${pendingDelete.brand} ${pendingDelete.model} (${pendingDelete.license_plate}) akan dihapus dari garasi.`
            : undefined
        }
        confirmLabel="Hapus kendaraan"
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? undefined : setPendingDelete(null))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Brand.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.md,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCopy: { flex: 1 },
  summaryTitle: { ...Type.bodyStrong, color: Brand.text, fontWeight: "700" },
  summaryText: { ...Type.meta, color: Brand.textSecondary, marginTop: 1 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    marginTop: Space.xl,
    marginBottom: Space.md,
  },
  sectionLabel: { ...Type.micro, color: Brand.textMuted },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Brand.border,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.md,
    marginBottom: Space.md,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    flex: 1,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: Radius.md,
    backgroundColor: Brand.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleThumb: { width: 68, borderRadius: Radius.md },
  copy: { flex: 1 },
  name: {
    ...Type.bodyStrong,
    fontSize: 14,
    fontWeight: "700",
    color: Brand.text,
  },
  meta: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  plate: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: Brand.divider,
    marginTop: 6,
  },
  plateText: {
    fontSize: 10,
    fontWeight: "700",
    color: Brand.textSecondary,
    letterSpacing: 0.4,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.xs,
    backgroundColor: Brand.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Space.sm,
  },
  addFooter: {
    marginTop: Space.md,
  },
  pressed: { opacity: 0.7 },
  primary: { flex: 1.6 },
});
