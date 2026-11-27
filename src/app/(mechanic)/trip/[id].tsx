import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { TripMap } from '@/features/mechanic/components/trip/trip-map';
import {
  TripSheet,
  type TripPhase,
} from '@/features/mechanic/components/trip/trip-sheet';
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
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { openPhoneDialer, openWhatsApp } from '@/utils/whatsapp';

const KEEP_AWAKE_TAG = 'montirgo-trip';
const TRIP_STATUSES = ['mechanic_accepted', 'on_the_way', 'arrived'];

/**
 * Layar perjalanan montir (trip mode) — peta realtime, rute + ETA,
 * dan gestur geser aman untuk "Mulai Perjalanan" serta "Sampai di Lokasi".
 */
export default function MechanicTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const [order, setOrder] = useState<MechanicOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(true);
  const [recenterToken, setRecenterToken] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(320);
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const cancelledHandledRef = useRef(false);

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

  useRefreshOnForeground(() => {
    void load();
  });

  useFocusEffect(
    useCallback(() => {
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      return () => {
        void deactivateKeepAwake(KEEP_AWAKE_TAG);
      };
    }, []),
  );

  useEffect(() => {
    if (!id) return;
    const channel = createRealtimeChannel(`mechanic-trip-${id}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` },
      () => void load(),
    );
    subscribeWithResync(channel, () => void load());
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  useEffect(() => {
    if (order?.status !== 'cancelled' || cancelledHandledRef.current) return;
    cancelledHandledRef.current = true;
    const timer = setTimeout(() => setCancelledOpen(true), 0);
    return () => clearTimeout(timer);
  }, [order?.status]);

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
        ? '< 1 mnt'
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
      showToast({
        tone: 'warning',
        title: 'Gagal membuka peta',
        message: 'Pastikan aplikasi peta tersedia di perangkat.',
      }),
    );
  }, [destination, showToast]);

  const callClient = useCallback(async () => {
    const res = await openPhoneDialer(phone);
    if (!res.ok && res.error) {
      showToast({ tone: 'warning', message: res.error });
    }
  }, [phone, showToast]);

  const chatClient = useCallback(async () => {
    if (!order) return;
    const res = await openWhatsApp(
      phone,
      `Halo, saya montir MontirGo yang menangani pesanan #${order.id
        .slice(0, 8)
        .toUpperCase()}. Saya sedang menuju lokasi.`,
    );
    if (!res.ok && res.error) {
      showToast({ tone: 'warning', message: res.error });
    }
  }, [order, phone, showToast]);

  const startTrip = useCallback(async () => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await updateOrderStatus(order.id, 'on_the_way');
      await load();
      showToast({
        tone: 'success',
        message: 'Perjalanan dimulai. Posisi GPS dibagikan ke client.',
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal memulai perjalanan',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setBusy(false);
    }
  }, [order, busy, load, showToast]);

  const confirmArrival = useCallback(async () => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await updateOrderStatus(order.id, 'arrived');
      showToast({
        tone: 'success',
        message: 'Tiba di lokasi! Susun estimasi biaya untuk client.',
      });
      router.replace({
        pathname: '/(mechanic)/active-order/[id]',
        params: { id: order.id, focus: 'invoice' },
      });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal memperbarui status',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
    } finally {
      setBusy(false);
    }
  }, [order, busy, router, showToast]);

  const handlePrimary = useCallback(() => {
    if (!order) return;
    if (phase === 'preview') {
      void startTrip();
      return;
    }
    if (phase === 'enroute') {
      void confirmArrival();
      return;
    }
    router.replace({
      pathname: '/(mechanic)/active-order/[id]',
      params: phase === 'arrived' ? { id: order.id, focus: 'invoice' } : { id: order.id },
    });
  }, [order, phase, startTrip, confirmArrival, router]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <LoadingState message="Menyiapkan perjalanan..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingScreen}>
        <ErrorState onRetry={() => void load()} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingScreen}>
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

  if (!TRIP_STATUSES.includes(order.status) && order.status !== 'cancelled') {
    return (
      <View style={styles.loadingScreen}>
        <EmptyState
          icon="checkmark-done-outline"
          message="Tidak ada perjalanan aktif"
          hint="Layar ini untuk order yang sudah disetujui client hingga tiba di lokasi."
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
        trafficAware={tracking.route?.trafficAware ?? true}
        onBack={() => router.back()}
        onAction={openInMaps}
      />

      {!following ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali mengikuti posisi montir"
          onPress={() => setRecenterToken((value) => value + 1)}
          style={[
            styles.recenter,
            theme.elevation.sheet,
            { bottom: sheetHeight + theme.spacing.md },
          ]}
        >
          <Ionicons name="locate" size={22} color={theme.colors.actionPrimaryBg} />
        </Pressable>
      ) : null}

      {tracking.routeLoading && tracking.position ? (
        <View style={[styles.loadingChip, { top: topInset + theme.spacing.sm }]}>
          <AppText variant="caption" tone="secondary">
            Menghitung rute…
          </AppText>
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
        onWhatsApp={() => void chatClient()}
        onCall={() => void callClient()}
        onOpenMaps={openInMaps}
        onRetryLocation={tracking.retryPermission}
        onHeightChange={setSheetHeight}
      />

      <ConfirmSheet
        visible={cancelledOpen}
        title="Order dibatalkan client"
        message="Client membatalkan pesanan ini. Perjalanan dihentikan."
        confirmLabel="Kembali ke Beranda"
        cancelLabel="Tutup"
        icon="close-circle-outline"
        destructive
        onConfirm={() => {
          setCancelledOpen(false);
          router.replace('/(mechanic)/(tabs)');
        }}
        onCancel={() => {
          setCancelledOpen(false);
          router.replace('/(mechanic)/(tabs)');
        }}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
    paddingTop: 60,
  },
  recenter: {
    position: 'absolute' as const,
    right: theme.spacing.lg,
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loadingChip: {
    position: 'absolute' as const,
    alignSelf: 'center' as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
});
