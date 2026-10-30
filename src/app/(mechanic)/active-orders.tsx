import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, ScreenPadding, Space } from '@/constants/brand';
import { listMyOrders, type MyOrder } from '@/features/mechanic/service';
import { syncMechanicPendingPayments } from '@/features/finance/service';
import { OrderCard } from '@/features/mechanic/components/order-card';

export default function MechanicActiveOrdersScreen() {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

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
    let cancelled = false;
    (async () => {
      try {
        let rows = await listMyOrders(true);
        if (await syncMechanicPendingPayments(rows)) {
          rows = await listMyOrders(true);
        }
        if (!cancelled) {
          setOrders(rows);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Order Aktif" subtitle="Order yang sedang kamu tangani" />
      {loading ? (
        <LoadingState message="Memuat order aktif..." />
      ) : (
        <ScrollView
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
          {error ? (
            <ErrorState onRetry={load} />
          ) : orders.length === 0 ? (
            <EmptyState
              icon="construct-outline"
              message="Belum ada order aktif"
              hint="Terima request di tab Request untuk mulai mengerjakan order."
              actionLabel="Lihat Request"
              onPressAction={() => router.push('/(mechanic)/(tabs)/requests')}
            />
          ) : (
            orders.map((order) => (
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
});
