import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { AppText } from '@/components/ui/text';
import { ActiveOrderCard } from '@/features/client/components/active-order-card';
import { HeroCard } from '@/features/client/components/hero-card';
import { HomeHeader } from '@/features/client/components/home-header';
import { HomeSummary } from '@/features/client/components/home-summary';
import { NearbyMechanics } from '@/features/client/components/nearby-mechanics';
import { PromoCarousel, type PromoKey } from '@/features/client/components/promo-carousel';
import { ServiceGrid } from '@/features/client/components/service-grid';
import { VehicleStrip } from '@/features/client/components/vehicle-strip';
import {
  getPrewarmedClientData,
  prewarmClientHome,
  setPrewarmedVehicles,
} from '@/features/client/prewarm';
import {
  getUnreadNotificationCount,
  listMyRequests,
  listMyVehicles,
  listOnlineMechanics,
  type ClientOrder,
  type ClientVehicle,
  type NearbyMechanic,
} from '@/features/client/service';
import { expireStaleAssignments } from '@/features/service-request/assignments';
import { TRIAGE_CATEGORIES, type ServiceCategory } from '@/features/service-request/categories';
import { isActiveStatus } from '@/features/service-request/status';
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { useSessionUser } from '@/hooks/use-session-user';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export default function ClientHomeScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user, loading: sessionLoading } = useSessionUser();
  const router = useRouter();

  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [mechanics, setMechanics] = useState<NearbyMechanic[]>([]);
  const [unread, setUnread] = useState(0);
  const [prewarm, setPrewarm] = useState(() => getPrewarmedClientData());
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
      if (active) openOrder(active);
      else router.push('/(client)/(tabs)/my-requests');
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
    try {
      await expireStaleAssignments();
      const [prewarmed, results] = await Promise.all([
        prewarmClientHome(),
        Promise.allSettled([
          listMyRequests(20),
          listMyVehicles(),
          listOnlineMechanics(10),
          getUnreadNotificationCount(),
        ]),
      ]);

      setPrewarm(prewarmed);
      const [orderResult, vehicleResult, mechanicResult, notificationResult] = results;

      if (orderResult.status === 'fulfilled') setOrders(orderResult.value);
      if (vehicleResult.status === 'fulfilled') {
        setVehicles(vehicleResult.value);
        setPrewarmedVehicles(vehicleResult.value);
      }
      if (mechanicResult.status === 'fulfilled') setMechanics(mechanicResult.value);
      if (notificationResult.status === 'fulfilled') setUnread(notificationResult.value);

      const failed = results.filter((result) => result.status === 'rejected').length;
      setFatalError(failed === results.length);
      setPartialError(failed > 0 && failed < results.length);
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

  useRefreshOnForeground(load);

  useEffect(() => {
    if (!user?.id) return;
    const channel = createRealtimeChannel(`client-home-${user.id}`).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'service_requests',
        filter: `client_id=eq.${user.id}`,
      },
      () => {
        void load();
      },
    );
    subscribeWithResync(channel, () => void load());
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

  const gpsActive = Boolean(prewarm.location);
  const gpsLabel = prewarm.location?.address
    ? `Lokasi siap · ${prewarm.location.address}`
    : prewarm.location
      ? `GPS siap (${prewarm.location.lat.toFixed(4)}, ${prewarm.location.lng.toFixed(4)})`
      : 'Lokasi diatur saat memesan bantuan';

  if (sessionLoading || loading) {
    return <HomeSkeleton />;
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
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
        <HomeHeader
          name={name}
          unreadCount={unread}
          gpsLabel={gpsLabel}
          gpsActive={gpsActive}
          onPressLocation={() =>
            router.push({ pathname: '/(client)/request/new', params: { category: 'montir' } })
          }
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
              {partialError ? (
                <View style={styles.partial}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={theme.colors.statusWarningFg}
                  />
                  <AppText variant="caption" tone="warning" style={styles.flexCopy}>
                    Sebagian data gagal dimuat. Tarik ke bawah untuk memuat ulang.
                  </AppText>
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
                    <Ionicons
                      name="person-add-outline"
                      size={20}
                      color={theme.colors.statusWarningFg}
                    />
                  </View>
                  <View style={styles.flexCopy}>
                    <AppText variant="label">Montir menunggu konfirmasimu</AppText>
                    <AppText variant="caption" tone="secondary" numberOfLines={2}>
                      {pendingAssignment.mechanic_name ?? 'Seorang montir'} ingin menangani pesananmu. Cek profil dan bengkelnya.
                    </AppText>
                  </View>
                  <View style={styles.confirmAction}>
                    <AppText variant="label" tone="inverse">
                      Cek
                    </AppText>
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.actionPrimaryFg} />
                  </View>
                </Pressable>
              ) : null}

              {activeOrder ? (
                <>
                  <SectionHeader
                    eyebrow="AKTIF SEKARANG"
                    title="Pesanan berjalan"
                    actionLabel="Semua"
                    onPressAction={() => router.push('/(client)/(tabs)/my-requests')}
                  />
                  <ActiveOrderCard order={activeOrder} onPress={() => openOrder(activeOrder)} />
                </>
              ) : null}

              <HeroCard
                startingCalloutFee={prewarm.pricing.callout_fee_motor}
                onPressRequest={() =>
                  router.push({
                    pathname: '/(client)/request/new',
                    params: { category: 'montir' },
                  })
                }
                onPressOrders={() => router.push('/(client)/(tabs)/my-requests')}
              />

              <SectionHeader
                eyebrow="TRIASE CEPAT"
                title="Apa masalah kendaraanmu?"
                actionLabel="Semua layanan"
                onPressAction={() => router.push('/(client)/services')}
              />
              <ServiceGrid categories={TRIAGE_CATEGORIES} onPressCategory={openCategory} />

              <SectionHeader eyebrow="RINGKASAN" title="Aktivitasmu" />
              <HomeSummary
                activeOrders={activeOrders.length}
                vehicles={vehicles.length}
                onlineMechanics={mechanics.length}
                onPressOrders={() => router.push('/(client)/(tabs)/my-requests')}
              />

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

              <SectionHeader eyebrow="PANDUAN" title="Alur MontirGo" />
              <PromoCarousel onPressPromo={openPromo} />
            </>
          )}

          {!fatalError && !activeOrder ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="shield-checkmark-outline"
                message="Belum ada pesanan aktif"
                hint="Ketuk salah satu kartu masalah di atas untuk memanggil montir dalam 3 langkah."
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function HomeSkeleton() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.skeletonHeader, { paddingTop: insets.top + theme.spacing.md }]}>
        <View style={styles.skeletonRow}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={styles.skeletonUser}>
            <Skeleton width={96} height={11} />
            <Skeleton width={160} height={18} />
          </View>
          <Skeleton width={48} height={48} radius={14} />
        </View>
        <Skeleton height={40} radius={12} />
        <Skeleton height={48} radius={14} />
      </View>

      <View style={styles.skeletonBody}>
        <Skeleton height={164} radius={16} />
        <Skeleton width={160} height={16} />
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} width="48%" height={112} radius={16} />
          ))}
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  scroll: { flex: 1 },
  content: {
    paddingBottom: theme.spacing.xxxl,
  },
  body: {
    paddingHorizontal: theme.spacing.screenPadding,
  },
  errorCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  partial: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  flexCopy: { flex: 1 },
  confirmBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  confirmIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  confirmAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xxs,
    backgroundColor: theme.colors.actionPrimaryBg,
    paddingHorizontal: theme.spacing.md,
    minHeight: 40,
    borderRadius: theme.radii.sm,
  },
  pressed: { opacity: 0.85 },
  emptyWrap: {
    marginTop: theme.spacing.md,
  },
  skeletonHeader: {
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: theme.spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  skeletonUser: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  skeletonBody: {
    padding: theme.spacing.screenPadding,
    gap: theme.spacing.lg,
  },
  skeletonGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
});
