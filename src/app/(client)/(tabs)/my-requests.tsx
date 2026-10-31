import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
import { supabase } from '@/lib/supabase';
import { listMyRequests, type ClientOrder } from '@/features/client/service';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { getStatusMeta, isActiveStatus } from '@/features/service-request/status';
import { formatDateTime, formatIDR } from '@/utils/format';

type FilterKey = 'all' | 'active' | 'done' | 'cancelled';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'done', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
];

export default function MyRequestsScreen() {
  const { user } = useSessionUser();
  const router = useRouter();

  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrders(await listMyRequests());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`client-orders-${user.id}`)
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

  const visible = useMemo(() => {
    if (filter === 'active') return orders.filter((order) => isActiveStatus(order.status));
    if (filter === 'done') return orders.filter((order) => order.status === 'paid');
    if (filter === 'cancelled') return orders.filter((order) => order.status === 'cancelled');
    return orders;
  }, [orders, filter]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Pesanan Saya"
        subtitle="Riwayat permintaan bantuan montir"
        showBack={false}
      />

      <View style={styles.filterBar}>
        {FILTERS.map((item) => {
          const active = item.key === filter;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <LoadingState message="Memuat pesanan..." />
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
          ) : visible.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              message="Belum ada pesanan"
              hint="Permintaan bantuan montir akan tampil di sini."
              actionLabel="Butuh Montir"
              onPressAction={() =>
                router.push({
                  pathname: '/(client)/request/new',
                  params: { category: 'montir' },
                })
              }
            />
          ) : (
            visible.map((order) => {
              const meta = getStatusMeta(order.status);
              const vehicle = formatVehicleLabel(
                order.vehicle_type,
                order.vehicle_brand,
                order.vehicle_model,
              );
              return (
                <Pressable
                  key={order.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Pesanan ${meta.label}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(client)/orders/[id]',
                      params: { id: order.id },
                    })
                  }
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.statusChip, { backgroundColor: meta.background }]}>
                      <Ionicons name={meta.icon} size={12} color={meta.color} />
                      <Text style={[styles.statusText, { color: meta.color }]}>
                        {meta.shortLabel}
                      </Text>
                    </View>
                    <Text style={styles.date}>{formatDateTime(order.created_at)}</Text>
                  </View>

                  <Text style={styles.issue} numberOfLines={2}>
                    {order.issue_description}
                  </Text>

                  <View style={styles.cardBottom}>
                    <View style={styles.metaRow}>
                      <Ionicons name="car-outline" size={13} color={Brand.textMuted} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {vehicle || 'Kendaraan tidak dicantumkan'}
                      </Text>
                    </View>
                    {order.price_amount != null ? (
                      <Text style={styles.price}>{formatIDR(order.price_amount)}</Text>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={Brand.textMuted} />
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  filterBar: {
    flexDirection: 'row',
    gap: Space.sm,
    paddingHorizontal: ScreenPadding,
    paddingVertical: Space.md,
  },
  filterChip: {
    paddingHorizontal: Space.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  filterChipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  filterText: { fontSize: 11.5, fontWeight: '600', color: Brand.textSecondary },
  filterTextActive: { color: Brand.white },
  content: { paddingHorizontal: ScreenPadding, paddingBottom: Space.xxxl },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.lg,
    marginBottom: Space.md,
  },
  pressed: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  statusText: { fontSize: 10.5, fontWeight: '700' },
  date: { fontSize: 10.5, color: Brand.textMuted },
  issue: { fontSize: 13.5, fontWeight: '600', color: Brand.text, marginTop: Space.md, lineHeight: 19 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.md,
    gap: Space.md,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  metaText: { fontSize: 11.5, color: Brand.textSecondary, flex: 1 },
  price: { fontSize: 13, fontWeight: '700', color: Brand.primary },
});
