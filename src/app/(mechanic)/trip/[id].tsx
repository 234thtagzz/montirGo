import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
import { TripMap } from '@/features/mechanic/components/trip/trip-map';
import { TripSheet, type TripPhase } from '@/features/mechanic/components/trip/trip-sheet';
import { TripTopBar } from '@/features/mechanic/components/trip/trip-top-bar';
import {
  getMyOrder,
  updateOrderStatus,
  type MechanicOrderDetail,
} from '@/features/mechanic/service';
import {
  formatArrivalClock,
  formatDistance,
  formatDuration,
} from '@/features/mechanic/tracking/geo';
import { useTripTracking } from '@/features/mechanic/tracking/use-trip-tracking';
import { supabase } from '@/lib/supabase';
import { openWhatsApp } from '@/utils/whatsapp';

const KEEP_AWAKE_TAG = 'montirgo-trip';
const TRIP_STATUSES = ['mechanic_assigned', 'mechanic_accepted', 'on_the_way', 'arrived'];

/**
 * Layar perjalanan montir (trip mode) — peta realtime, rute + ETA, dan aksi
 * "Sampai di Lokasi". Menggantikan alur sebelumnya yang hanya berupa tombol
 * status di layar detail.
 */
export default function MechanicTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<MechanicOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(true);
  const [recenterToken, setRecenterToken] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(320);
  const cancelledAlertRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const detail = await getMyOrder(id);
      setOrder(detail);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void load();
      return () => setFocused(false);
    }, [load]),
  );

  // Layar navigasi tidak boleh mati saat montir berkendara.
  useFocusEffect(
    useCallback(() => {
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      return () => {
        void deactivateKeepAwake(KEEP_AWAKE_TAG);
      };
    }, []),
  );

  // Realtime: client bisa membatalkan / mengubah order di tengah perjalanan.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`mechanic-trip-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    if (order?.status !== 'cancelled' || cancelledAlertRef.current) return;
    cancelledAlertRef.current = true;
    Alert.alert(
      'Order dibatalkan',
      'Client membatalkan pesanan ini. Perjalanan dihentikan.',
      [{ text: 'Kembali ke Beranda', onPress: () => router.replace('/(mechanic)/(tabs)') }],
    );
  }, [order?.status, router]);

  const latitude = order?.lat;
  const longitude = order?.lng;
  const destination = useMemo(
    () =>
      latitude != null && longitude != null
        ? { latitude, longitude }
        : null,
    [latitude, longitude],
  );

  const tracking = useTripTracking({
    requestId: id,
    destination,
    status: order?.status,
    active: focused && order != null,
  });

  const phase: TripPhase = !order
    ? 'preview'
    : order.status === 'on_the_way'
      ? 'enroute'
      : order.status === 'arrived'
        ? 'arrived'
        : TRIP_STATUSES.includes(order.status)
          ? 'preview'
          : 'completed';

  const isLive = phase === 'enroute';
  const etaLabel =
    tracking.etaSeconds == null
      ? '—'
      : tracking.etaSeconds <= 60
        ? 'Tiba'
        : formatDuration(tracking.etaSeconds);
  const distanceLabel = formatDistance(tracking.remainingDistanceM);
  const arrivalClock = isLive ? formatArrivalClock(tracking.etaSeconds) : null;
  const vehicleLabel = [order?.vehicle_brand, order?.vehicle_model]
    .filter(Boolean)
    .join(' ');
  const phone = order?.client_phone ?? order?.contact_phone ?? null;

  const openInMaps = useCallback(() => {
    if (!destination) return;
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${destination.latitude},${destination.longitude}` +
      `&travelmode=driving`;
    void Linking.openURL(url).catch(() =>
      Alert.alert('Gagal membuka peta', 'Pastikan aplikasi peta tersedia di perangkat.'),
    );
  }, [destination]);

  const callClient = useCallback(() => {
    if (!phone) return;
    const digits = phone.replace(/[^+0-9]/g, '');
    void Linking.openURL(`tel:${digits}`).catch(() =>
      Alert.alert('Gagal menelepon', 'Perangkat tidak mendukung panggilan telepon.'),
    );
  }, [phone]);

  const chatClient = useCallback(() => {
    if (!order) return;
    void openWhatsApp(
      phone,
      `Halo, saya montir MontirGo yang menangani pesanan #${order.id
        .slice(0, 8)
        .toUpperCase()}. Saya sedang menuju lokasi.`,
    );
  }, [order, phone]);

  const startTrip = useCallback(async () => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await updateOrderStatus(order.id, 'on_the_way');
      await load();
    } catch (e) {
      Alert.alert('Gagal memulai perjalanan', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setBusy(false);
    }
  }, [order, busy, load]);

  const confirmArrival = useCallback(() => {
    if (!order || busy) return;
    Alert.alert(
      'Sampai di lokasi?',
      'Pastikan kamu sudah berada di titik lokasi client. Status order akan berubah menjadi "Montir sudah tiba".',
      [
        { text: 'Belum', style: 'cancel' },
        {
          text: 'Ya, saya tiba',
          onPress: async () => {
            setBusy(true);
            try {
              await updateOrderStatus(order.id, 'arrived');
              router.replace({
                pathname: '/(mechanic)/active-order/[id]',
                params: { id: order.id },
              });
            } catch (e) {
              Alert.alert('Gagal memperbarui status', e instanceof Error ? e.message : 'Coba lagi.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [order, busy, router]);

  const handlePrimary = useCallback(() => {
    if (!order) return;
    if (phase === 'preview') {
      void startTrip();
      return;
    }
    if (phase === 'enroute') {
      confirmArrival();
      return;
    }
    router.replace({
      pathname: '/(mechanic)/active-order/[id]',
      params: { id: order.id },
    });
  }, [order, phase, startTrip, confirmArrival, router]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <LoadingState message="Menyiapkan perjalanan..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ErrorState onRetry={load} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <EmptyState
          icon="map-outline"
          message="Perjalanan tidak ditemukan"
          hint="Order ini bukan milikmu atau sudah tidak aktif."
          actionLabel="Kembali ke Beranda"
          onPressAction={() => router.replace('/(mechanic)/(tabs)')}
        />
      </View>
    );
  }

  if (!TRIP_STATUSES.includes(order.status)) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <EmptyState
          icon="checkmark-done-outline"
          message="Tidak ada perjalanan aktif"
          hint="Layar ini hanya untuk order yang sedang menuju lokasi client."
          actionLabel="Buka Detail Order"
          onPressAction={() =>
            router.replace({
              pathname: '/(mechanic)/active-order/[id]',
              params: { id: order.id },
            })
          }
        />
      </View>
    );
  }

  const topInset = insets.top + 96;
  const subtitle =
    phase === 'preview'
      ? `Rute ke lokasi client · ${distanceLabel}`
      : phase === 'enroute'
        ? `${etaLabel} · ${distanceLabel}`
        : 'Tiba di lokasi client';

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <TripMap
        mechanic={tracking.position}
        heading={tracking.heading}
        destination={destination}
        route={tracking.route}
        estimated={tracking.usingEstimatedRoute}
        topInset={topInset}
        bottomInset={sheetHeight}
        recenterToken={recenterToken}
        onFollowChange={setFollowing}
      />

      <TripTopBar
        title={phase === 'preview' ? 'Menuju lokasi client' : 'Perjalanan ke lokasi client'}
        subtitle={subtitle}
        estimated={tracking.usingEstimatedRoute && phase !== 'preview'}
        onBack={() => router.back()}
        onOpenMaps={openInMaps}
      />

      {!following ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali mengikuti posisi montir"
          onPress={() => setRecenterToken((value) => value + 1)}
          style={[styles.recenter, { bottom: sheetHeight + Space.md }]}
        >
          <Ionicons name="locate" size={20} color={Brand.primary} />
        </Pressable>
      ) : null}

      {tracking.routeLoading && tracking.position ? (
        <View style={[styles.loadingChip, { top: topInset + Space.sm }]}>
          <Text style={styles.loadingChipText}>Menghitung rute…</Text>
        </View>
      ) : null}

      <TripSheet
        clientName={order.client_name}
        phone={phone}
        vehicleLabel={vehicleLabel}
        address={order.address}
        etaLabel={etaLabel}
        distanceLabel={distanceLabel}
        arrivalClock={arrivalClock}
        phase={phase}
        isNearDestination={tracking.isNearDestination}
        busy={busy}
        hasLocation={tracking.position != null}
        locationError={tracking.locationError}
        onPrimary={handlePrimary}
        onWhatsApp={chatClient}
        onCall={callClient}
        onOpenMaps={openInMaps}
        onRetryLocation={tracking.retryPermission}
        onHeightChange={setSheetHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  loadingScreen: { flex: 1, backgroundColor: Brand.background, paddingTop: 60 },
  recenter: {
    position: 'absolute',
    right: Space.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1B33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingChip: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surface,
  },
  loadingChipText: { fontSize: 11, fontWeight: '600', color: Brand.textSecondary },
});
