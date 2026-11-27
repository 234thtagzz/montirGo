import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import type { ClientOrder } from '@/features/client/service';
import {
  STALE_LOCATION_MS,
  useMechanicTracking,
} from '@/features/client/tracking/use-mechanic-tracking';
import { TripMap } from '@/features/mechanic/components/trip/trip-map';
import { TripTopBar } from '@/features/mechanic/components/trip/trip-top-bar';
import {
  formatArrivalClock,
  formatDistance,
  formatDuration,
} from '@/features/mechanic/tracking/geo';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { openPhoneDialer, openWhatsApp } from '@/utils/whatsapp';
import { ClientTripSheet } from './client-trip-sheet';

interface ClientTripViewProps {
  order: ClientOrder;
  onBack: () => void;
  onOpenDetail: () => void;
}

/**
 * Layar pelacakan perjalanan montir sisi client (Light & Dark + Toast feedback).
 */
export function ClientTripView({ order, onBack, onOpenDetail }: ClientTripViewProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [following, setFollowing] = useState(true);
  const [recenterToken, setRecenterToken] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(320);

  const destination = useMemo(
    () =>
      order.lat != null && order.lng != null
        ? { latitude: order.lat, longitude: order.lng }
        : null,
    [order.lat, order.lng],
  );

  const tracking = useMechanicTracking({
    requestId: order.id,
    destination,
    routeSnapshot: {
      polyline: order.route_polyline,
      distanceMeters: order.route_distance_m,
      durationSeconds: order.route_duration_s,
      updatedAt: order.route_updated_at,
    },
  });
  const route = tracking.route;

  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const isStale =
    tracking.updatedAt != null && now > 0 && now - tracking.updatedAt > STALE_LOCATION_MS;
  const arrived = route != null && route.distanceMeters <= 0;
  const etaLabel = !route ? '—' : arrived ? 'Tiba' : formatDuration(route.durationSeconds);
  const distanceLabel = route ? formatDistance(route.distanceMeters) : '—';
  const arrivalClock =
    route && !arrived ? formatArrivalClock(route.durationSeconds) : route ? 'Sekarang' : null;
  const phone = order.mechanic_phone;

  const callMechanic = useCallback(async () => {
    const res = await openPhoneDialer(phone);
    if (!res.ok) {
      showToast({
        tone: 'warning',
        title: 'Gagal menelepon',
        message: res.error ?? 'Perangkat tidak mendukung panggilan telepon.',
      });
    }
  }, [phone, showToast]);

  const chatMechanic = useCallback(async () => {
    const res = await openWhatsApp(
      phone,
      `Halo, saya client MontirGo untuk pesanan #${order.id
        .slice(0, 8)
        .toUpperCase()}. Saya memantau perjalananmu ke lokasi saya.`,
    );
    if (!res.ok) {
      showToast({
        tone: 'warning',
        title: 'WhatsApp tidak tersedia',
        message: res.error ?? 'Coba hubungi via telepon.',
      });
    }
  }, [order.id, phone, showToast]);

  const topInset = insets.top + 96;
  const subtitle = tracking.waiting
    ? 'Menunggu posisi montir…'
    : route
      ? `${etaLabel} · ${distanceLabel}`
      : 'Menghitung rute…';
  const hasPhone = Boolean(phone);

  return (
    <View style={styles.screen}>
      <TripMap
        mechanic={tracking.position}
        heading={null}
        destination={destination}
        route={route}
        estimated={route?.estimated ?? false}
        mode="client"
        topInset={topInset}
        bottomInset={sheetHeight}
        recenterToken={recenterToken}
        onFollowChange={setFollowing}
      />

      <TripTopBar
        title="Montir menuju lokasimu"
        subtitle={subtitle}
        estimated={route?.estimated ?? false}
        trafficAware={route?.trafficAware ?? true}
        onBack={onBack}
        onAction={hasPhone ? () => void chatMechanic() : onOpenDetail}
        actionIcon={hasPhone ? 'logo-whatsapp' : 'document-text-outline'}
        actionLabel={hasPhone ? 'Chat montir' : 'Buka detail pesanan'}
        actionTone={hasPhone ? 'whatsapp' : 'primary'}
      />

      {!following ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali melihat seluruh rute"
          onPress={() => {
            setFollowing(true);
            setRecenterToken((value) => value + 1);
          }}
          style={({ pressed }) => [
            styles.recenter,
            theme.elevation.sheet,
            { bottom: sheetHeight + theme.spacing.md },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="locate" size={20} color={theme.colors.actionPrimaryAltBg} />
        </Pressable>
      ) : null}

      {tracking.routeLoading && tracking.position ? (
        <View style={[styles.loadingChip, theme.elevation.card, { top: topInset + theme.spacing.sm }]}>
          <Ionicons name="navigate-outline" size={14} color={theme.colors.textSecondary} />
          <AppText variant="caption" tone="secondary">
            Menghitung rute tercepat…
          </AppText>
        </View>
      ) : null}

      <ClientTripSheet
        mechanicName={order.mechanic_name}
        mechanicAvatar={order.mechanic_avatar}
        phone={phone}
        address={order.address}
        etaLabel={etaLabel}
        distanceLabel={distanceLabel}
        arrivalClock={arrivalClock}
        waiting={tracking.waiting}
        stale={isStale}
        onWhatsApp={() => void chatMechanic()}
        onCall={() => void callMechanic()}
        onOpenDetail={onOpenDetail}
        onHeightChange={setSheetHeight}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  recenter: {
    position: 'absolute' as const,
    right: theme.spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loadingChip: {
    position: 'absolute' as const,
    alignSelf: 'center' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  pressed: { opacity: 0.78 },
});
