import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { syncMechanicPendingPayments } from '@/features/finance/service';
import { OrderCard } from '@/features/mechanic/components/order-card';
import { listMyOrders, type MyOrder } from '@/features/mechanic/service';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export default function MechanicActiveOrdersScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      let rows = await listMyOrders(true);
      if (await syncMechanicPendingPayments(rows)) {
        rows = await listMyOrders(true);
      }
      setOrders(rows);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const listHeader =
    !error && orders.length > 0 ? (
      <Surface variant="default" padding="md" style={styles.summary}>
        <View style={styles.summaryIcon}>
          <Ionicons
            name="construct-outline"
            size={18}
            color={theme.colors.statusInfoFg}
          />
        </View>
        <View style={styles.summaryCopy}>
          <AppText variant="bodyStrong">
            {orders.length} order sedang berjalan
          </AppText>
          <AppText variant="caption" tone="secondary">
            Status diperbarui otomatis saat client dan pembayaran berubah.
          </AppText>
        </View>
      </Surface>
    ) : undefined;

  const emptyContent = error ? (
    <ErrorState onRetry={() => void load()} />
  ) : (
    <EmptyState
      icon="construct-outline"
      message="Belum ada order aktif"
      hint="Terima request di tab Request untuk mulai mengerjakan order."
      actionLabel="Lihat Request"
      onPressAction={() => router.push('/(mechanic)/(tabs)/requests')}
    />
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Order Aktif"
        subtitle="Order yang sedang kamu tangani"
      />
      {loading ? (
        <LoadingState message="Memuat order aktif..." />
      ) : (
        <FlatList
          data={error ? [] : orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyContent}
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
          renderItem={({ item: order }) => (
            <OrderCard
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
              action={{
                label: 'Laporkan',
                icon: 'alert-circle-outline',
                variant: 'ghost',
                onPress: () =>
                  router.push({
                    pathname: '/(mechanic)/complaints',
                    params: { requestId: order.id },
                  }),
              }}
            />
          )}
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    padding: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xxxl,
  },
  summary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
});
