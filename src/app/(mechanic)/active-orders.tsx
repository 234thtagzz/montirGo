import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Ionicons } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { listMyOrders, type MyOrder } from '@/features/mechanic/service';
import { syncMechanicPendingPayments } from '@/features/finance/service';
import { OrderCard } from '@/features/mechanic/components/order-card';
import { formatVehicleLabel } from '@/features/vehicles/constants';

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
            <>
              <View style={styles.summary}>
                <View style={styles.summaryIcon}>
                  <Ionicons name="construct-outline" size={17} color={Brand.primary} />
                </View>
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryTitle}>
                    {orders.length} order sedang berjalan
                  </Text>
                  <Text style={styles.summaryText}>
                    Status diperbarui otomatis saat client dan pembayaran berubah.
                  </Text>
                </View>
              </View>
              {orders.map((order) => (
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
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.md,
    marginBottom: Space.md,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: { flex: 1 },
  summaryTitle: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700' },
  summaryText: { ...Type.meta, color: Brand.textSecondary, marginTop: 1 },
});
