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
import { supabase } from '@/lib/supabase';
import {
  getEarningsSummary,
  getMechanicProfile,
  listMyOrders,
  setOnlineStatus,
  type MyOrder,
} from '@/features/mechanic/service';
import { DashboardHeader } from '@/features/mechanic/components/dashboard-header';
import { OnlineCard } from '@/features/mechanic/components/online-card';
import { OrderCard } from '@/features/mechanic/components/order-card';
import { StatTiles } from '@/features/mechanic/components/stat-tiles';

export default function MechanicDashboardScreen() {
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const [online, setOnline] = useState(false);
  const [verified, setVerified] = useState(false);
  const [todayNet, setTodayNet] = useState(0);
  const [todayJobs, setTodayJobs] = useState(0);
  const [activeOrders, setActiveOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

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
      setActiveOrders(await listMyOrders(true));
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
        setActiveOrders(await listMyOrders(true));
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
    const ch = supabase
      .channel('mechanic-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, load)
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
        <DashboardHeader name={name} isOnline={online} isVerified={verified} />

        <View style={styles.body}>
          <OnlineCard online={online} onToggle={toggleOnline} />

          {error ? (
            <View style={styles.errorCard}>
              <ErrorState onRetry={load} />
            </View>
          ) : (
            <>
              <StatTiles
                netToday={todayNet}
                jobsToday={todayJobs}
                activeOrders={activeOrders.length}
                onPressEarnings={() => router.push('/(mechanic)/earnings')}
              />

              <SectionHeader
                title="Order aktif"
                actionLabel="Lihat semua"
                onPressAction={() => router.push('/(mechanic)/active-orders')}
              />
              {activeOrders.length === 0 ? (
                <EmptyState
                  icon="construct-outline"
                  message="Belum ada order aktif"
                  hint="Nyalakan status online supaya request client bisa masuk."
                  actionLabel="Lihat Request"
                  onPressAction={() => router.push('/(mechanic)/requests')}
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
                      vehicle={[order.vehicle_brand, order.vehicle_model].filter(Boolean).join(' ')}
                      clientName={order.client_name}
                      address={order.address}
                      price={order.price_amount}
                      onPress={() => router.push(`/(mechanic)/active-order/${order.id}`)}
                    />
                  ))
              )}

              <SectionHeader title="Aksi cepat" />
              <View style={styles.actions}>
                <Button
                  label="Lihat Request Masuk"
                  icon="flash-outline"
                  onPress={() => router.push('/(mechanic)/requests')}
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
          <Skeleton width={44} height={44} radius={22} style={styles.onBlue} />
          <View style={styles.skeletonUser}>
            <Skeleton width={80} height={10} style={styles.onBlue} />
            <Skeleton width={120} height={14} style={styles.onBlue} />
          </View>
          <Skeleton width={78} height={30} radius={15} style={styles.onBlue} />
        </View>
        <Skeleton width={230} height={20} style={[styles.onBlue, { marginTop: Space.lg }]} />
      </View>

      <View style={styles.skeletonBody}>
        <Skeleton height={104} radius={18} style={{ marginTop: -44 }} />
        <Skeleton height={84} radius={18} style={{ marginTop: Space.md }} />
        <View style={styles.skeletonGrid}>
          <Skeleton height={96} radius={18} style={styles.skeletonHalf} />
          <Skeleton height={96} radius={18} style={styles.skeletonHalf} />
        </View>
        <Skeleton width={120} height={14} />
        <Skeleton height={96} radius={18} style={{ marginTop: Space.md }} />
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
  actions: { gap: Space.md },
  skeletonHeader: {
    backgroundColor: Brand.primary,
    paddingHorizontal: ScreenPadding,
    paddingBottom: 64,
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  skeletonUser: { flex: 1, gap: 6 },
  onBlue: { backgroundColor: 'rgba(255,255,255,0.28)' },
  skeletonBody: { paddingHorizontal: ScreenPadding },
  skeletonGrid: { flexDirection: 'row', gap: Space.md, marginTop: Space.md },
  skeletonHalf: { flex: 1 },
});
