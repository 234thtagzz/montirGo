import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LoadingState, ErrorState } from '@/components/ui/state';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/ui/section-header';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Tabular, Type, Gradient } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
import { createRealtimeChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import {
  getUnreadNotificationCount,
  listMyRequests,
  listMyVehicles,
  listOnlineMechanics,
  type ClientOrder,
  type ClientVehicle,
  type NearbyMechanic,
} from '@/features/client/service';
import { isActiveStatus } from '@/features/service-request/status';
import { expireStaleAssignments } from '@/features/service-request/assignments';
import { SERVICE_CATEGORIES, type ServiceCategory } from '@/features/service-request/categories';
import { HomeHeader } from '@/features/client/components/home-header';
import { HeroCard } from '@/features/client/components/hero-card';
import { ServiceGrid } from '@/features/client/components/service-grid';
import { PromoCarousel, type PromoKey } from '@/features/client/components/promo-carousel';
import { ActiveOrderCard } from '@/features/client/components/active-order-card';
import { NearbyMechanics } from '@/features/client/components/nearby-mechanics';
import { VehicleStrip } from '@/features/client/components/vehicle-strip';
import { formatVehicleLabel } from '@/features/vehicles/constants';

export default function ClientHomeScreen() {
  const { user, loading: sessionLoading } = useSessionUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [mechanics, setMechanics] = useState<NearbyMechanic[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState(false);
  const [partialError, setPartialError] = useState(false);
  const [focused, setFocused] = useState(true);

  // Fungsi navigasi
  const openOrder = (order: ClientOrder) => {
    router.push(
      order.status === 'on_the_way'
        ? { pathname: '/(client)/tracking/[id]', params: { id: order.id } }
        : { pathname: '/(client)/orders/[id]', params: { id: order.id } },
    );
  };

  const openCategory = (category: ServiceCategory) => {
    if (category.route === 'vehicles') {
      router.push('/(client)/(tabs)/my-vehicles');
      return;
    }
    if (category.route === 'services') {
      router.push('/(client)/services');
      return;
    }
    router.push({
      pathname: '/(client)/request/new',
      params: { category: category.key },
    });
  };

  const openPromo = (key: PromoKey) => {
    if (key === 'track') {
      const active = orders.find((order) => isActiveStatus(order.status));
      if (active) {
        openOrder(active);
      } else router.push('/(client)/(tabs)/my-requests');
      return;
    }
    if (key === 'vehicle') {
      router.push('/(client)/vehicles/new');
      return;
    }
    router.push({
      pathname: '/(client)/request/new',
      params: { category: 'montir' },
    });
  };

  const load = useCallback(async () => {
    await expireStaleAssignments();
    const results = await Promise.allSettled([
      listMyRequests(20),
      listMyVehicles(),
      listOnlineMechanics(10),
      getUnreadNotificationCount(),
    ]);

    const [orderResult, vehicleResult, mechanicResult, notificationResult] = results;

    if (orderResult.status === 'fulfilled') setOrders(orderResult.value);
    if (vehicleResult.status === 'fulfilled') setVehicles(vehicleResult.value);
    if (mechanicResult.status === 'fulfilled') setMechanics(mechanicResult.value);
    if (notificationResult.status === 'fulfilled') setUnread(notificationResult.value);

    const failed = results.filter((result) => result.status === 'rejected').length;
    setFatalError(failed === results.length);
    setPartialError(failed > 0 && failed < results.length);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      load();
      return () => setFocused(false);
    }, [load]),
  );

  const activeOrder = orders.find((order) => isActiveStatus(order.status)) ?? null;
  const pendingAssignment =
    orders.find(
      (order) => order.status === 'mechanic_assigned' && Boolean(order.mechanic_id),
    ) ?? null;
  const name = user?.fullName || user?.email || 'Pengguna';

  if (sessionLoading || loading) {
    return <HomeSkeleton />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar style={focused ? 'light' : 'dark'} />
      <ScrollView
        style={styles.scroll}
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
        <HomeHeader
          name={name}
          unreadCount={unread}
          onPressProfile={() => router.push('/(client)/(tabs)/profile')}
          onPressNotifications={() => router.push('/(client)/notifications')}
          onPressSearch={() => router.push('/(client)/services')}
        />

        <View style={styles.body}>
          {fatalError ? (
            <View style={styles.errorCard}>
              <ErrorState onRetry={load} />
            </View>
          ) : (
            <>
              <HeroCard
                onPressRequest={() =>
                  router.push({
                    pathname: '/(client)/request/new',
                    params: { category: 'montir' },
                  })
                }
                onPressOrders={() => router.push('/(client)/(tabs)/my-requests')}
              />

              {partialError ? (
                <View style={styles.partial}>
                  <Ionicons name="information-circle-outline" size={15} color={Brand.amber} />
                  <Text style={styles.partialText}>
                    Sebagian data gagal dimuat. Tarik ke bawah untuk mencoba lagi.
                  </Text>
                </View>
              ) : null}

              {pendingAssignment ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Konfirmasi montir untuk pesanan aktif"
                  onPress={() => openOrder(pendingAssignment)}
                  style={({ pressed }) => [styles.confirmBanner, pressed && styles.pressed]}
                >
                  <View style={styles.confirmIcon}>
                    <Ionicons name="person-add-outline" size={20} color={Brand.amber} />
                  </View>
                  <View style={styles.confirmCopy}>
                    <Text style={styles.confirmTitle}>Montir menunggu konfirmasimu</Text>
                    <Text style={styles.confirmText} numberOfLines={2}>
                      {pendingAssignment.mechanic_name ?? 'Seorang montir'} ingin menangani
                      pesananmu. Cek rating, ulasan, dan bengkelnya sebelum menyetujui.
                    </Text>
                  </View>
                  <View style={styles.confirmAction}>
                    <Text style={styles.confirmActionText}>Konfirmasi</Text>
                    <Ionicons name="chevron-forward" size={14} color={Brand.amber} />
                  </View>
                </Pressable>
              ) : null}

              <SectionHeader title="Layanan" actionLabel="Lihat semua" onPressAction={() => router.push('/(client)/services')} />
              <ServiceGrid categories={SERVICE_CATEGORIES} onPressCategory={openCategory} />

              {activeOrder ? (
                <>
                  <SectionHeader title="Pesanan aktif" actionLabel="Semua pesanan" onPressAction={() => router.push('/(client)/(tabs)/my-requests')} />
                  <ActiveOrderCard order={activeOrder} onPress={() => openOrder(activeOrder)} />
                </>
              ) : null}

              <SectionHeader title="Promo & info" />
              <PromoCarousel onPressPromo={openPromo} />

              <SectionHeader title="Montir terdekat" />
              <NearbyMechanics mechanics={mechanics} />

              <SectionHeader title="Kendaraan saya" actionLabel="Kelola" onPressAction={() => router.push('/(client)/(tabs)/my-vehicles')} />
              <VehicleStrip
                vehicles={vehicles}
                onPressVehicle={(vehicle) =>
                  router.push({
                    pathname: '/(client)/request/new',
                    params: { category: 'montir', vehicleId: vehicle.id },
                  })
                }
                onPressAdd={() => router.push('/(client)/vehicles/new')}
                onPressManage={() => router.push('/(client)/(tabs)/my-vehicles')}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function HomeSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.skeletonScreen}>
      <StatusBar style="light" />
      <View style={[styles.skeletonHeader, { paddingTop: insets.top + Space.md }]}>
        <View style={styles.skeletonRow}>
          <Skeleton width={38} height={38} radius={19} style={styles.onBlue} />
          <View style={styles.skeletonUser}>
            <Skeleton width={90} height={10} style={styles.onBlue} />
            <Skeleton width={130} height={14} style={styles.onBlue} />
          </View>
          <Skeleton width={40} height={40} radius={20} style={styles.onBlue} />
        </View>
        <Skeleton width={210} height={20} style={[styles.onBlue, { marginTop: Space.lg }]} />
        <Skeleton height={48} radius={14} style={{ marginTop: Space.md }} />
      </View>

      <View style={styles.skeletonBody}>
        <Skeleton height={118} radius={18} style={{ marginTop: -44 }} />
        <View>
          {Array.from({ length: 8 }).map((_, index) => (
            <View key={index}>
              <Skeleton width={52} height={52} radius={14} />
              <Skeleton width={48} height={9} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
        <Skeleton width={120} height={14} />
        <Skeleton height={84} radius={18} style={{ marginTop: Space.md }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  scroll: { flex: 1 },
  content: { paddingBottom: Space.xxxl },
  body: { paddingHorizontal: ScreenPadding },
  errorCard: {
    backgroundColor: Brand.surface,
    borderRadius: 18,
    marginTop: -44,
    paddingVertical: Space.lg,
  },
  partial: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: Brand.amberSoft,
    borderRadius: 10,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    marginTop: Space.md,
  },
  partialText: { flex: 1, fontSize: 11, color: Brand.amber },
  confirmIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCopy: { flex: 1 },
  confirmTitle: { fontSize: 13, fontWeight: '800', color: Brand.text },
  confirmText: { fontSize: 11, color: Brand.textSecondary, lineHeight: 15, marginTop: 2 },
  confirmAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  confirmActionText: { fontSize: 11.5, fontWeight: '800', color: Brand.amber },
  skeletonScreen: { flex: 1, backgroundColor: Brand.background },
  skeletonHeader: {
    backgroundColor: Brand.ink,
    paddingHorizontal: ScreenPadding,
    paddingBottom: 64,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  skeletonUser: { flex: 1, gap: 6 },
  onBlue: { backgroundColor: 'rgba(255,255,255,0.28)' },
  skeletonBody: { paddingHorizontal: ScreenPadding },
  confirmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.amberSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.amber,
    padding: Space.md,
    marginTop: Space.md,
  },
  pressed: { opacity: 0.85 },
});