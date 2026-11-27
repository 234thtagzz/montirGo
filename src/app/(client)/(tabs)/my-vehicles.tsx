import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import {
  deleteVehicle,
  listMyVehicles,
  type ClientVehicle,
} from '@/features/client/service';
import { VehiclePhoto } from '@/features/vehicles/components/vehicle-photo';
import { getVehicleTypeMeta } from '@/features/vehicles/constants';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

const VEHICLE_ICON: Record<ClientVehicle['type'], IconName> = {
  motor: 'bicycle-outline',
  mobil: 'car-outline',
  lainnya: 'cube-outline',
};

export default function MyVehiclesScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClientVehicle | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteVehicle(pendingDelete.id);
      setPendingDelete(null);
      await load();
      showToast({
        tone: 'success',
        title: 'Kendaraan dihapus',
        message: 'Data kendaraan telah dihapus dari garasi.',
      });
    } catch (deleteError) {
      showToast({
        tone: 'danger',
        title: 'Gagal menghapus',
        message: deleteError instanceof Error ? deleteError.message : 'Coba lagi.',
      });
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
                void load();
              }}
              tintColor={theme.colors.actionPrimaryAltBg}
              colors={[theme.colors.actionPrimaryAltBg]}
            />
          }
        >
          {error ? (
            <ErrorState onRetry={load} />
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon="car-outline"
              message="Garasi masih kosong"
              hint="Simpan kendaraanmu agar kategori motor/mobil terisi otomatis saat memanggil montir."
              actionLabel="Tambah Kendaraan"
              onPressAction={() => router.push('/(client)/vehicles/new')}
            />
          ) : (
            <>
              <Surface variant="default" padding="md" style={styles.summary}>
                <View style={styles.summaryIcon}>
                  <Ionicons
                    name="car-sport-outline"
                    size={18}
                    color={theme.colors.statusInfoFg}
                  />
                </View>
                <View style={styles.flexCopy}>
                  <AppText variant="label">
                    {vehicles.length} kendaraan tersimpan
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    Pilih kendaraan saat membuat permintaan agar montir lebih siap.
                  </AppText>
                </View>
              </Surface>

              <View style={styles.sectionRow}>
                <AppText variant="overline" tone="muted">
                  Daftar kendaraan
                </AppText>
                <View style={styles.sectionLine} />
              </View>

              {vehicles.map((vehicle) => {
                const meta = getVehicleTypeMeta(vehicle.type);
                const tonePalette = theme.tones[meta.tone];
                return (
                  <Surface key={vehicle.id} variant="default" padding="md" style={styles.card}>
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
                          height={60}
                          style={styles.vehicleThumb}
                          emptyLabel={null}
                        />
                      ) : (
                        <View style={[styles.iconBox, { backgroundColor: tonePalette.bg }]}>
                          <Ionicons
                            name={VEHICLE_ICON[vehicle.type] ?? 'car-outline'}
                            size={22}
                            color={tonePalette.fg}
                          />
                        </View>
                      )}
                      <View style={styles.copy}>
                        <AppText variant="title" numberOfLines={1}>
                          {vehicle.brand} {vehicle.model}
                        </AppText>
                        <AppText variant="caption" tone="secondary">
                          {meta.label}
                          {vehicle.year ? ` · ${vehicle.year}` : ''}
                        </AppText>
                        <View style={styles.plate}>
                          <AppText variant="caption" tone="secondary" style={styles.plateText}>
                            {vehicle.license_plate}
                          </AppText>
                        </View>
                      </View>
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={theme.colors.textMuted}
                      />
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus ${vehicle.brand} ${vehicle.model}`}
                      hitSlop={8}
                      onPress={() => setPendingDelete(vehicle)}
                      style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={theme.colors.statusDangerFg}
                      />
                    </Pressable>
                  </Surface>
                );
              })}

              <Button
                label="Tambah Kendaraan"
                icon="add"
                onPress={() => router.push('/(client)/vehicles/new')}
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
        onConfirm={() => void confirmDelete()}
        onCancel={() => (deleting ? undefined : setPendingDelete(null))}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    padding: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.md,
  },
  summary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  flexCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  sectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
  },
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  cardMain: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    flex: 1,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: theme.radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  vehicleThumb: {
    width: 68,
    borderRadius: theme.radii.md,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  plate: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    marginTop: theme.spacing.xxs,
  },
  plateText: {
    fontFamily: theme.fontFamily.bold,
    letterSpacing: 0.4,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusDangerBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: theme.spacing.xs,
  },
  pressed: { opacity: 0.78 },
  primary: {
    marginTop: theme.spacing.sm,
  },
});
