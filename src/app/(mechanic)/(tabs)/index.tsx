import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { BalanceCard } from '@/features/finance/components/balance-card';
import {
  getWallet,
  syncMechanicPendingPayments,
  type MechanicWallet,
} from '@/features/finance/service';
import { AssignmentPendingCard } from '@/features/mechanic/components/assignment-pending-card';
import { DashboardHeader } from '@/features/mechanic/components/dashboard-header';
import { OnlineCard } from '@/features/mechanic/components/online-card';
import { OrderCard } from '@/features/mechanic/components/order-card';
import { StatTiles } from '@/features/mechanic/components/stat-tiles';
import { TripEntryCard } from '@/features/mechanic/components/trip/trip-entry-card';
import { getMechanicProgressLabel } from '@/features/mechanic/constants';
import {
  getEarningsSummary,
  getMechanicProfile,
  getMyProfileRow,
  listMyOrders,
  setOnlineStatus,
  type MyOrder,
} from '@/features/mechanic/service';
import { useMechanicAlerts } from '@/features/notifications/mechanic-alerts';
import { expireStaleAssignments } from '@/features/service-request/assignments';
import { getQuoteStatusMeta, getStatusMeta } from '@/features/service-request/status';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { useSessionUser } from '@/hooks/use-session-user';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

export default function MechanicDashboardScreen() {
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const router = useRouter();
  const { unread } = useMechanicAlerts();

  const [online, setOnline] = useState(false);
  const [verified, setVerified] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [todayNet, setTodayNet] = useState(0);
  const [todayJobs, setTodayJobs] = useState(0);
  const [activeOrders, setActiveOrders] = useState<MyOrder[]>([]);
  const [wallet, setWallet] = useState<MechanicWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [profileResult, identityResult, earningsResult, ordersResult, walletResult] =
        await Promise.allSettled([
          getMechanicProfile(),
          getMyProfileRow(),
          getEarningsSummary(startOfDay.toISOString()),
          (async () => {
            await expireStaleAssignments();
            let orders = await listMyOrders(true);
            try {
              if (await syncMechanicPendingPayments(orders)) {
                orders = await listMyOrders(true);
              }
            } catch {
              // Tetap tampilkan order yang sudah terbaca.
            }
            return orders;
          })(),
          getWallet(),
        ]);

      if (profileResult.status === 'fulfilled') {
        setOnline(profileResult.value?.is_online ?? false);
        setVerified(profileResult.value?.is_verified ?? false);
      }
      if (identityResult.status === 'fulfilled') {
        setAvatarUrl(identityResult.value.avatar_url ?? null);
      }
      if (earningsResult.status === 'fulfilled') {
        setTodayNet(earningsResult.value.net);
        setTodayJobs(earningsResult.value.totalJobs);
      }
      if (ordersResult.status === 'fulfilled') {
        setActiveOrders(ordersResult.value);
      }
      if (walletResult.status === 'fulfilled') {
        setWallet(walletResult.value);
      }

      const failed = [
        profileResult,
        earningsResult,
        ordersResult,
        walletResult,
      ].filter((result) => result.status === 'rejected').length;
      setError(failed === 4);
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

  useRefreshOnForeground(() => {
    void load();
  });

  const userId = sessionUser?.id;
  useEffect(() => {
    if (!userId) return;
    const ch = createRealtimeChannel(`mechanic-dashboard-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `mechanic_id=eq.${userId}` },
        () => void load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mechanic_wallets', filter: `mechanic_id=eq.${userId}` },
        () => void load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'withdrawals', filter: `mechanic_id=eq.${userId}` },
        () => void load(),
      );
    subscribeWithResync(ch, () => void load());
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  const toggleOnline = async (value: boolean) => {
    setOnline(value);
    try {
      await setOnlineStatus(value);
      showToast({
        tone: value ? 'success' : 'info',
        message: value ? 'Kamu sekarang SIAGA menerima order.' : 'Mode offline diaktifkan.',
      });
    } catch (e) {
      setOnline(!value);
      showToast({
        tone: 'danger',
        title: 'Gagal mengubah status',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat lagi.',
      });
    }
  };

  if (loading || sessionLoading) {
    return <DashboardSkeleton />;
  }

  const name = sessionUser?.fullName || sessionUser?.email || 'Montir';
  const primaryActive = activeOrders[0] ?? null;
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
  const onsiteOrPaymentOrder =
    activeOrders.find((order) => order.status === 'arrived') ??
    activeOrders.find((order) => order.status === 'payment');

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
            tintColor={theme.colors.actionPrimaryBg}
            colors={[theme.colors.actionPrimaryBg]}
          />
        }
      >
        <DashboardHeader
          name={name}
          avatarUrl={avatarUrl}
          isOnline={online}
          isVerified={verified}
          unreadNotifications={unread}
          onPressNotifications={() => router.push('/(mechanic)/notifications')}
        />

        <View style={styles.body}>
          <OnlineCard online={online} onToggle={(value) => void toggleOnline(value)} />

          {pendingAssignment ? (
            <AssignmentPendingCard
              expiresAt={pendingAssignment.assignment_expires_at}
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
          ) : onsiteOrPaymentOrder ? (
            <ActiveStageBanner
              order={onsiteOrPaymentOrder}
              onPress={() =>
                router.push({
                  pathname: '/(mechanic)/active-order/[id]',
                  params: {
                    id: onsiteOrPaymentOrder.id,
                    ...(onsiteOrPaymentOrder.status === 'arrived'
                      ? { focus: 'invoice' }
                      : {}),
                  },
                })
              }
            />
          ) : primaryActive ? (
            <ActiveStageBanner
              order={primaryActive}
              onPress={() =>
                router.push(`/(mechanic)/active-order/${primaryActive.id}`)
              }
            />
          ) : null}

          <BalanceCard
            wallet={wallet}
            onPressWithdraw={() => router.push('/(mechanic)/withdraw')}
            onPressAccounts={() => router.push('/(mechanic)/payout-accounts')}
          />

          {error ? (
            <Surface variant="default" padding="lg" style={styles.errorCard}>
              <ErrorState onRetry={() => void load()} />
            </Surface>
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
                  hint="Aktifkan saklar SIAGA di atas agar permintaan darurat bisa langsung masuk."
                  actionLabel="Buka Request Masuk"
                  onPressAction={() => router.push('/(mechanic)/(tabs)/requests')}
                />
              ) : (
                activeOrders.slice(0, 3).map((order) => (
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
                  variant="primary"
                  size="cta"
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

function ActiveStageBanner({
  order,
  onPress,
}: {
  order: MyOrder;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const statusMeta = getStatusMeta(order.status);
  const quoteMeta = getQuoteStatusMeta(order.quote_status);
  const isArrived = order.status === 'arrived';

  const ctaLabel =
    isArrived && order.quote_status === 'draft'
      ? 'Susun & Kirim Estimasi'
      : isArrived && order.quote_status === 'approved'
        ? 'Kelola & Finalisasi Tagihan'
        : isArrived && order.quote_status === 'pending_approval'
          ? 'Pantau Persetujuan Client'
          : order.status === 'payment'
            ? 'Kelola Pembayaran'
            : 'Buka Detail Order';

  return (
    <Surface variant="elevated" padding="lg" style={styles.stageCard}>
      <View style={styles.stageTop}>
        <Badge
          size="sm"
          tone={isArrived ? quoteMeta.tone : statusMeta.tone}
          icon={isArrived ? quoteMeta.icon : statusMeta.icon}
          label={isArrived ? quoteMeta.shortLabel : statusMeta.shortLabel}
        />
        {order.price_amount != null ? (
          <AppText variant="label" tabular>
            {formatIDR(order.price_amount)}
          </AppText>
        ) : order.callout_fee_amount != null ? (
          <AppText variant="caption" tone="secondary" tabular>
            Panggil {formatIDR(order.callout_fee_amount)}
          </AppText>
        ) : null}
      </View>

      <AppText variant="bodyStrong" style={styles.stageTitle}>
        {getMechanicProgressLabel(order.status, order.quote_status)}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={2}>
        {order.client_name ?? 'Client'} · {order.issue_description}
      </AppText>

      <Button
        label={ctaLabel}
        icon="arrow-forward-outline"
        variant="primary"
        size="cta"
        onPress={onPress}
        style={styles.stageBtn}
      />
    </Surface>
  );
}

function DashboardSkeleton() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.screen}>
      <View style={[styles.skeletonHeader, { paddingTop: insets.top + 16 }]}>
        <View style={styles.skeletonRow}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={styles.skeletonUser}>
            <Skeleton width={96} height={11} />
            <Skeleton width={160} height={16} />
          </View>
          <Skeleton width={48} height={48} radius={14} />
        </View>
        <Skeleton height={38} radius={12} />
      </View>

      <View style={styles.body}>
        <Skeleton height={132} radius={16} />
        <Skeleton height={180} radius={16} style={styles.skeletonGap} />
        <Skeleton height={124} radius={16} style={styles.skeletonGap} />
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing.xxxl,
  },
  body: {
    paddingHorizontal: theme.spacing.screenPadding,
  },
  stageCard: {
    marginTop: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.statusInfoBorder,
    gap: theme.spacing.xs,
  },
  stageTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  stageTitle: {
    marginTop: theme.spacing.xxs,
  },
  stageBtn: {
    marginTop: theme.spacing.sm,
  },
  errorCard: {
    marginTop: theme.spacing.md,
  },
  performance: {
    marginTop: theme.spacing.md,
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  skeletonHeader: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  skeletonUser: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  skeletonGap: {
    marginTop: theme.spacing.md,
  },
});
