import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/state';
import { SectionHeader } from '@/components/ui/section-header';
import { Ionicons } from '@/components/ui/icon';
import { Brand, ScreenPadding, Space } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
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
import {
  SERVICE_CATEGORIES,
  type ServiceCategory,
} from '@/features/service-request/categories';
import { HomeHeader } from '@/features/client/components/home-header';
import { HeroCard } from '@/features/client/components/hero-card';
import { ServiceGrid } from '@/features/client/components/service-grid';
import { PromoCarousel, type PromoKey } from '@/features/client/components/promo-carousel';
import { ActiveOrderCard } from '@/features/client/components/active-order-card';
import { NearbyMechanics } from '@/features/client/components/nearby-mechanics';
import { VehicleStrip } from '@/features/client/components/vehicle-strip';

export default function ClientHomeScreen() {
  const { user, loading: sessionLoading } = useSessionUser();
  const router = useRouter();

  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [mechanics, setMechanics] = useState<NearbyMechanic[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fatalError, setFatalError] = useState(false);
  const [partialError, setPartialError] = useState(false);
  const [focused, setFocused] = useState(true);

  const load = useCallback(async () => {
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

  // Realtime: status pesanan client berubah tanpa perlu tarik-refresh.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`client-home-${user.id}`)
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

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const retry = () => {
    setLoading(true);
    load();
  };

  const openCategory = (category: ServiceCategory) => {
    if (category.route === 'vehicles') {
      router.push('/(client)/my-vehicles');
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
        router.push({
          pathname: '/(client)/orders/[id]',
          params: { id: active.id },
        });
      } else router.push('/(client)/my-requests');
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

  const activeOrder = orders.find((order) => isActiveStatus(order.status)) ?? null;
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
            onRefresh={onRefresh}
            tintColor={Brand.primary}
            colors={[Brand.primary]}
          />
        }
      >
        <HomeHeader
          name={name}
          unreadCount={unread}
          onPressProfile={() => router.push('/(client)/profile')}
          onPressNotifications={() => router.push('/(client)/notifications')}
          onPressSearch={() => router.push('/(client)/services')}
        />

        <View style={styles.body}>
          {fatalError ? (
            <View style={styles.errorCard}>
              <ErrorState onRetry={retry} />
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
                onPressOrders={() => router.push('/(client)/my-requests')}
              />

              {partialError ? (
                <View style={styles.partial}>
                  <Ionicons name="information-circle-outline" size={15} color={Brand.amber} />
                  <Text style={styles.partialText}>
                    Sebagian data gagal dimuat. Tarik ke bawah untuk mencoba lagi.
                  </Text>
                </View>
              ) : null}

              <SectionHeader
                title="Layanan"
                actionLabel="Lihat semua"
                onPressAction={() => router.push('/(client)/services')}
              />
              <ServiceGrid categories={SERVICE_CATEGORIES} onPressCategory={openCategory} />

              {activeOrder ? (
                <>
                  <SectionHeader
                    title="Pesanan aktif"
                    actionLabel="Semua pesanan"
                    onPressAction={() => router.push('/(client)/my-requests')}
                  />
                  <ActiveOrderCard
                    order={activeOrder}
                    onPress={() =>
                      router.push({
                        pathname: '/(client)/orders/[id]',
                        params: { id: activeOrder.id },
                      })
                    }
                  />
                </>
              ) : null}

              <SectionHeader title="Promo & info" />
              <PromoCarousel onPressPromo={openPromo} />

              <SectionHeader title="Montir terdekat" />
              <NearbyMechanics mechanics={mechanics} />

              <SectionHeader
                title="Kendaraan saya"
                actionLabel="Kelola"
                onPressAction={() => router.push('/(client)/my-vehicles')}
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
                onPressManage={() => router.push('/(client)/my-vehicles')}
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
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 8 }).map((_, index) => (
            <View key={index} style={styles.skeletonGridItem}>
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
  skeletonScreen: { flex: 1, backgroundColor: Brand.background },
  skeletonHeader: {
    backgroundColor: Brand.primary,
    paddingHorizontal: ScreenPadding,
    paddingBottom: 64,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  skeletonUser: { flex: 1, gap: 6 },
  onBlue: { backgroundColor: 'rgba(255,255,255,0.28)' },
  skeletonBody: { paddingHorizontal: ScreenPadding },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Space.xl,
    marginBottom: Space.lg,
  },
  skeletonGridItem: { width: '25%', alignItems: 'center', marginBottom: Space.lg },
});
