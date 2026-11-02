import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
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
import { openWhatsApp } from '@/utils/whatsapp';
import { ClientTripSheet } from './client-trip-sheet';

interface ClientTripViewProps {
  order: ClientOrder;
  onBack: () => void;
  onOpenDetail: () => void;
}

/**
 * Layar perjalanan versi client — tampilannya mengikuti layar trip montir:
 * peta penuh, kartu status mengambang di atas, dan bottom sheet yang bisa
 * dilipat berisi ETA, jarak, jam tiba, serta aksi chat/telepon montir.
 *
 * Aktif hanya saat status order `on_the_way`; sumber posisi memakai hook
 * pasif `useMechanicTracking` (tanpa izin GPS di perangkat client).
 */
export function ClientTripView({ order, onBack, onOpenDetail }: ClientTripViewProps) {
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

  const tracking = useMechanicTracking({ requestId: order.id, destination });
  const route = tracking.route;

  // Jam relatif & perkiraan tiba ikut diperbarui walau tidak ada titik baru.
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

  const callMechanic = useCallback(() => {
    if (!phone) return;
    const digits = phone.replace(/[^+0-9]/g, '');
    void Linking.openURL(`tel:${digits}`).catch(() =>
      Alert.alert('Gagal menelepon', 'Perangkat tidak mendukung panggilan telepon.'),
    );
  }, [phone]);

  const chatMechanic = useCallback(() => {
    void openWhatsApp(
      phone,
      `Halo, saya client MontirGo untuk pesanan #${order.id
        .slice(0, 8)
        .toUpperCase()}. Saya memantau perjalananmu ke lokasi saya.`,
    );
  }, [order.id, phone]);

  const topInset = insets.top + 96;
  const subtitle = tracking.waiting
    ? 'Menunggu posisi montir…'
    : route
      ? `${etaLabel} · ${distanceLabel}`
      : 'Menghitung rute…';
  const hasPhone = Boolean(phone);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

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
        onAction={hasPhone ? chatMechanic : onOpenDetail}
        actionIcon={hasPhone ? 'logo-whatsapp' : 'document-text-outline'}
        actionLabel={hasPhone ? 'Chat montir' : 'Buka detail pesanan'}
        actionBackground={hasPhone ? Brand.whatsapp : Brand.primary}
      />

      {!following ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali melihat seluruh rute"
          onPress={() => {
            setFollowing(true);
            setRecenterToken((value) => value + 1);
          }}
          style={[styles.recenter, { bottom: sheetHeight + Space.md }]}
        >
          <Ionicons name="locate" size={20} color={Brand.primary} />
        </Pressable>
      ) : null}

      {tracking.routeLoading && tracking.position ? (
        <View style={[styles.loadingChip, { top: topInset + Space.sm }]}>
          <Ionicons name="navigate-outline" size={12} color={Brand.textSecondary} />
          <Text style={styles.loadingChipText}>Menghitung rute tercepat…</Text>
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
        onWhatsApp={chatMechanic}
        onCall={callMechanic}
        onOpenDetail={onOpenDetail}
        onHeightChange={setSheetHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surface,
    shadowColor: '#0B1B33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  loadingChipText: { fontSize: 11, fontWeight: '600', color: Brand.textSecondary },
});
