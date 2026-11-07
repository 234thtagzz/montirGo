import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/ui/section-header';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
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
import { HomeSummary } from '@/features/client/components/home-summary';
import { ServiceGrid } from '@/features/client/components/service-grid';
import { PromoCarousel, type PromoKey } from '@/features/client/components/promo-carousel';
import { ActiveOrderCard } from '@/features/client/components/active-order-card';
import { NearbyMechanics } from '@/features/client/components/nearby-mechanics';
import { VehicleStrip } from '@/features/client/components/vehicle-strip';

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
      load();
    }, [load]),
  );

  // Status pesanan berubah tanpa perlu tarik-refresh.
  useEffect(() => {
    if (!user?.id) return;
    const channel = createRealtimeChannel(`client-home-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests',
          filter: `client_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const activeOrders = orders.filter((order) => isActiveStatus(order.status));
  const activeOrder = activeOrders[0] ?? null;
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
      <StatusBar style="light" />
      <View style={[styles.statusBackdrop, { height: insets.top }]} />

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

              <HomeSummary
                activeOrders={activeOrders.length}
                vehicles={vehicles.length}
                onlineMechanics={mechanics.length}
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
                    <Ionicons name="chevron-forward" size={14} color={Brand.volt} />
                  </View>
                </Pressable>
              ) : null}

              <SectionHeader
                eyebrow="PEKERJAAN"
                title="Pesanan aktif"
                actionLabel={activeOrder ? 'Semua pesanan' : undefined}
                onPressAction={
                  activeOrder ? () => router.push('/(client)/(tabs)/my-requests') : undefined
                }
              />
              {activeOrder ? (
                <ActiveOrderCard order={activeOrder} onPress={() => openOrder(activeOrder)} />
              ) : (
                <EmptyState
                  icon="construct-outline"
                  message="Belum ada pesanan aktif"
                  hint="Pilih layanan di bawah untuk meminta bantuan montir."
                  actionLabel="Lihat layanan"
                  onPressAction={() => router.push('/(client)/services')}
                />
              )}

              <SectionHeader
                eyebrow="KATALOG"
                title="Layanan"
                actionLabel="Lihat semua"
                onPressAction={() => router.push('/(client)/services')}
              />
              <ServiceGrid categories={SERVICE_CATEGORIES} onPressCategory={openCategory} />

              <SectionHeader eyebrow="DI SEKITAR" title="Montir terdekat" />
              <NearbyMechanics mechanics={mechanics} />

              <SectionHeader
                eyebrow="GARASI"
                title="Kendaraan saya"
                actionLabel="Kelola"
                onPressAction={() => router.push('/(client)/(tabs)/my-vehicles')}
              />
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

              <SectionHeader eyebrow="INFO" title="Promo & panduan" />
              <PromoCarousel onPressPromo={openPromo} />
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
          <Skeleton width={42} height={42} radius={21} style={styles.onInk} />
          <View style={styles.skeletonUser}>
            <Skeleton width={90} height={9} style={styles.onInk} />
            <Skeleton width={150} height={15} style={styles.onInk} />
          </View>
          <Skeleton width={42} height={42} radius={14} style={styles.onInk} />
        </View>
        <View style={styles.skeletonMeta}>
          <Skeleton width={96} height={22} radius={11} style={styles.onInk} />
          <Skeleton width={80} height={12} style={styles.onInk} />
        </View>
        <Skeleton height={46} radius={14} style={{ marginTop: Space.lg }} />
      </View>

      <View style={styles.skeletonBody}>
        <Skeleton height={132} radius={18} style={{ marginTop: -40 }} />
        <Skeleton height={128} radius={18} style={{ marginTop: Space.md }} />
        <Skeleton width={120} height={14} style={{ marginTop: Space.xxl }} />
        <Skeleton height={104} radius={18} style={{ marginTop: Space.md }} />
        <Skeleton width={120} height={14} style={{ marginTop: Space.xxl }} />

        <View style={styles.skeletonGrid}>
          {Array.from({ length: 8 }).map((_, index) => (
            <View key={index} style={styles.skeletonGridItem}>
              <Skeleton width={50} height={50} radius={14} />
              <Skeleton width={46} height={9} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  scroll: { flex: 1 },
  content: { paddingBottom: Space.xxxl },
  statusBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Brand.ink,
    zIndex: 2,
  },
  body: { paddingHorizontal: ScreenPadding },
  errorCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    marginTop: -40,
    paddingVertical: Space.lg,
  },
  partial: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    marginTop: Space.md,
  },
  partialText: { flex: 1, fontSize: 11, color: Brand.amber },
  confirmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#F2D48A',
    padding: Space.md,
    marginTop: Space.md,
  },
  confirmIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCopy: { flex: 1 },
  confirmTitle: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700' },
  confirmText: { ...Type.meta, color: '#7C5A12', lineHeight: 15, marginTop: 2 },
  confirmAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.ink,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  confirmActionText: { ...Type.label, color: Brand.white, fontWeight: '800' },
  pressed: { opacity: 0.85 },
  skeletonScreen: { flex: 1, backgroundColor: Brand.background },
  skeletonHeader: {
    backgroundColor: Brand.ink,
    paddingHorizontal: ScreenPadding,
    paddingBottom: 58,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  skeletonUser: { flex: 1, gap: 7 },
  skeletonMeta: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: Space.xl },
  onInk: { backgroundColor: 'rgba(255,255,255,0.16)' },
  skeletonBody: { paddingHorizontal: ScreenPadding },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Space.lg,
  },
  skeletonGridItem: { width: '25%', alignItems: 'center', marginBottom: Space.lg },
});
