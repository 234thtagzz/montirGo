import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { Brand, ScreenPadding, Space } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
import { createRealtimeChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import {
  getEarningsSummary,
  getMechanicProfile,
  listMyOrders,
  setOnlineStatus,
  type MyOrder,
} from '@/features/mechanic/service';
import { DashboardHeader } from '@/features/mechanic/components/dashboard-header';
import { useMechanicAlerts } from '@/features/notifications/mechanic-alerts';
import { OnlineCard } from '@/features/mechanic/components/online-card';
import { OrderCard } from '@/features/mechanic/components/order-card';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { TripEntryCard } from '@/features/mechanic/components/trip/trip-entry-card';
import { AssignmentPendingCard } from '@/features/mechanic/components/assignment-pending-card';
import { expireStaleAssignments } from '@/features/service-request/assignments';
import { StatTiles } from '@/features/mechanic/components/stat-tiles';
import { BalanceCard } from '@/features/finance/components/balance-card';
import {
  getWallet,
  syncMechanicPendingPayments,
  type MechanicWallet,
} from '@/features/finance/service';

export default function MechanicDashboardScreen() {
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const [online, setOnline] = useState(false);
  const [verified, setVerified] = useState(false);
  const [todayNet, setTodayNet] = useState(0);
  const [todayJobs, setTodayJobs] = useState(0);
  const [activeOrders, setActiveOrders] = useState<MyOrder[]>([]);
  const [wallet, setWallet] = useState<MechanicWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  const { unread } = useMechanicAlerts();

  const load = useCallback(async () => {
    try {
      const profile = await getMechanicProfile();
      setOnline(profile?.is_online ?? false);
      setVerified(profile?.is_verified ?? false);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const sum = await getEarningsSummary(startOfDay.toISOString());
      setTodayNet(sum.net);
      setTodayJobs(sum.totalJobs);
      let orders = await listMyOrders(true);
      // Webhook Xendit bisa telat/belum terdaftar: cek langsung ke Xendit agar
      // order yang sudah dibayar client berubah menjadi lunas di Beranda.
      if (await syncMechanicPendingPayments(orders)) {
        orders = await listMyOrders(true);
      }
      setActiveOrders(orders);
      setWallet(await getWallet());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Pastikan order yang baru diterima langsung muncul saat kembali ke Beranda,
  // meskipun realtime belum terpasang di database.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getMechanicProfile();
        if (cancelled) return;
        setOnline(profile?.is_online ?? false);
        setVerified(profile?.is_verified ?? false);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const sum = await getEarningsSummary(startOfDay.toISOString());
        if (cancelled) return;
        setTodayNet(sum.net);
        setTodayJobs(sum.totalJobs);
        await expireStaleAssignments();
        let orders = await listMyOrders(true);
        if (await syncMechanicPendingPayments(orders)) {
          orders = await listMyOrders(true);
        }
        if (cancelled) return;
        setActiveOrders(orders);
        setWallet(await getWallet());
        if (!cancelled) setError(false);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    // Realtime: order baru / perubahan status langsung refresh dashboard.
    const ch = createRealtimeChannel('mechanic-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mechanic_wallets' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [load]);

  const toggleOnline = async (value: boolean) => {
    setOnline(value);
    try {
      await setOnlineStatus(value);
    } catch (e) {
      setOnline(!value);
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Tidak bisa mengubah status.');
    }
  };

  if (loading || sessionLoading) {
    return <DashboardSkeleton />;
  }

  const name = sessionUser?.fullName || sessionUser?.email || 'Montir';
  const pendingAssignment = activeOrders.find(
    (order) => order.status === 'mechanic_assigned',
  );
  const tripOrder =
    activeOrders.find((order) => order.status === 'on_the_way') ??
    activeOrders.find((order) => order.status === 'mechanic_accepted');
  const tripStatus =
    tripOrder?.status === 'on_the_way'
      ? 'on_the_way'
      : tripOrder?.status === 'mechanic_accepted'
        ? 'mechanic_accepted'
        : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
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
        <DashboardHeader
          name={name}
          isOnline={online}
          isVerified={verified}
          unreadNotifications={unread}
          onPressNotifications={() => router.push('/(mechanic)/notifications')}
        />

        <View style={styles.body}>
          <OnlineCard online={online} onToggle={toggleOnline} />

          <BalanceCard
            wallet={wallet}
            onPressWithdraw={() => router.push('/(mechanic)/withdraw')}
            onPressAccounts={() => router.push('/(mechanic)/payout-accounts')}
          />

          {pendingAssignment ? (
            <AssignmentPendingCard
              onPress={() =>
                router.push(`/(mechanic)/active-order/${pendingAssignment.id}`)
              }
            />
          ) : tripOrder && tripStatus ? (
            <TripEntryCard
              status={tripStatus}
              onPress={() =>
                router.push({
                  pathname: '/(mechanic)/trip/[id]',
                  params: { id: tripOrder.id },
                })
              }
            />
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <ErrorState onRetry={load} />
            </View>
          ) : (
            <>
              <View style={styles.performance}>
                <StatTiles
                  netToday={todayNet}
                  jobsToday={todayJobs}
                  activeOrders={activeOrders.length}
                  onPressEarnings={() => router.push('/(mechanic)/earnings')}
                />
              </View>

              <SectionHeader
                eyebrow="PEKERJAAN"
                title="Order aktif"
                actionLabel={activeOrders.length > 0 ? 'Lihat semua' : undefined}
                onPressAction={
                  activeOrders.length > 0
                    ? () => router.push('/(mechanic)/active-orders')
                    : undefined
                }
              />
              {activeOrders.length === 0 ? (
                <EmptyState
                  icon="construct-outline"
                  message="Belum ada order aktif"
                  hint="Nyalakan status online supaya request client bisa masuk."
                  actionLabel="Lihat Request"
                  onPressAction={() => router.push('/(mechanic)/(tabs)/requests')}
                />
              ) : (
                activeOrders
                  .slice(0, 3)
                  .map((order) => (
                    <OrderCard
                      key={order.id}
                      issue={order.issue_description}
                      status={order.status}
                      createdAt={order.created_at}
                      vehicle={formatVehicleLabel(
                        order.vehicle_type,
                        order.vehicle_brand,
                        order.vehicle_model,
                      )}
                      clientName={order.client_name}
                      address={order.address}
                      price={order.price_amount}
                      onPress={() => router.push(`/(mechanic)/active-order/${order.id}`)}
                    />
                  ))
              )}

              <View style={styles.actions}>
                <Button
                  label="Request Masuk"
                  icon="flash-outline"
                  variant="ink"
                  onPress={() => router.push('/(mechanic)/(tabs)/requests')}
                />
                <Button
                  label="Rincian Pendapatan"
                  icon="wallet-outline"
                  variant="secondary"
                  onPress={() => router.push('/(mechanic)/earnings')}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DashboardSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.skeletonHeader, { paddingTop: insets.top + Space.md }]}>
        <View style={styles.skeletonRow}>
          <Skeleton width={46} height={46} radius={23} style={styles.onBlue} />
          <View style={styles.skeletonUser}>
            <Skeleton width={90} height={9} style={styles.onBlue} />
            <Skeleton width={150} height={15} style={styles.onBlue} />
          </View>
          <Skeleton width={42} height={42} radius={14} style={styles.onBlue} />
        </View>
      </View>

      <View style={styles.skeletonBody}>
        <Skeleton height={120} radius={18} style={{ marginTop: -40 }} />
        <Skeleton height={210} radius={18} style={{ marginTop: Space.md }} />
        <Skeleton height={132} radius={18} style={{ marginTop: Space.md }} />
        <Skeleton width={120} height={14} style={{ marginTop: Space.xxl }} />
        <Skeleton height={104} radius={18} style={{ marginTop: Space.md }} />
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
    marginTop: Space.md,
    paddingVertical: Space.lg,
  },
  performance: { marginTop: Space.md },
  actions: { gap: Space.sm, marginTop: Space.xxl },
  skeletonHeader: {
    backgroundColor: Brand.ink,
    paddingHorizontal: ScreenPadding,
    paddingBottom: 58,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  skeletonUser: { flex: 1, gap: 7 },
  onBlue: { backgroundColor: 'rgba(255,255,255,0.16)' },
  skeletonBody: { paddingHorizontal: ScreenPadding },
});
