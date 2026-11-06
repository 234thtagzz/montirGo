import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Tabular, Type } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
import { createRealtimeChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { listMyRequests, type ClientOrder } from '@/features/client/service';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { getStatusMeta, isActiveStatus } from '@/features/service-request/status';
import { formatDayLabel, formatIDR, formatTime } from '@/utils/format';

type FilterKey = 'all' | 'active' | 'done' | 'cancelled';

const FILTERS: SegmentedOption<FilterKey>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'done', label: 'Selesai' },
  { value: 'cancelled', label: 'Batal' },
];

interface DayGroup {
  key: string;
  label: string;
  orders: ClientOrder[];
}

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
    const channel = createRealtimeChannel(`client-orders-${user.id}`)
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

  const counts = useMemo(
    () => ({
      active: orders.filter((order) => isActiveStatus(order.status)).length,
      done: orders.filter((order) => order.status === 'paid').length,
      total: orders.length,
    }),
    [orders],
  );

  const groups = useMemo<DayGroup[]>(() => {
    const visible = orders.filter((order) => {
      if (filter === 'active') return isActiveStatus(order.status);
      if (filter === 'done') return order.status === 'paid';
      if (filter === 'cancelled') return order.status === 'cancelled';
      return true;
    });

    const map = new Map<string, DayGroup>();
    visible.forEach((order) => {
      const label = formatDayLabel(order.created_at);
      const existing = map.get(label);
      if (existing) existing.orders.push(order);
      else map.set(label, { key: label, label, orders: [order] });
    });
    return Array.from(map.values());
  }, [orders, filter]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Pesanan"
        subtitle="Riwayat dan status bantuan montir"
        showBack={false}
      />

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
          <View style={styles.summary}>
            <SummaryStat label="Total" value={counts.total} />
            <View style={styles.summaryDivider} />
            <SummaryStat label="Aktif" value={counts.active} accent={Brand.primary} />
            <View style={styles.summaryDivider} />
            <SummaryStat label="Selesai" value={counts.done} accent={Brand.green} />
          </View>

          <Segmented
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            style={styles.segmented}
          />

          {error ? (
            <ErrorState onRetry={load} />
          ) : groups.length === 0 ? (
            <EmptyState
              icon="receipt-outline"
              message={filter === 'all' ? 'Belum ada pesanan' : 'Tidak ada pesanan di filter ini'}
              hint="Permintaan bantuan montir akan tampil di sini."
              actionLabel={filter === 'all' ? 'Butuh Montir' : undefined}
              onPressAction={
                filter === 'all'
                  ? () =>
                      router.push({
                        pathname: '/(client)/request/new',
                        params: { category: 'montir' },
                      })
                  : undefined
              }
            />
          ) : (
            groups.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={styles.groupLabel}>{group.label}</Text>
                {group.orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onPress={() =>
                      router.push({
                        pathname: '/(client)/orders/[id]',
                        params: { id: order.id },
                      })
                    }
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, Tabular, accent ? { color: accent } : null]}>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function OrderRow({ order, onPress }: { order: ClientOrder; onPress: () => void }) {
  const meta = getStatusMeta(order.status);
  const pendingConfirmation =
    order.status === 'mechanic_assigned' && Boolean(order.mechanic_id);
  const vehicle = formatVehicleLabel(
    order.vehicle_type,
    order.vehicle_brand,
    order.vehicle_model,
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pesanan ${meta.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.rail, { backgroundColor: meta.color }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.statusRow}>
            <Ionicons name={meta.icon} size={12} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.shortLabel}</Text>
          </View>
          <Text style={[styles.time, Tabular]}>{formatTime(order.created_at)}</Text>
        </View>

        <Text style={styles.issue} numberOfLines={2}>
          {order.issue_description}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="car-outline" size={12} color={Brand.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {vehicle || 'Kendaraan tidak dicantumkan'}
          </Text>
        </View>

        <View style={styles.cardBottom}>
          {order.price_amount != null ? (
            <Text style={[styles.price, Tabular]}>{formatIDR(order.price_amount)}</Text>
          ) : (
            <Text style={styles.priceMuted}>Belum ada tagihan</Text>
          )}
          <Ionicons name="chevron-forward" size={15} color={Brand.textMuted} />
        </View>

        {pendingConfirmation ? (
          <View style={styles.pendingRow}>
            <Ionicons name="person-add-outline" size={13} color={Brand.amber} />
            <Text style={styles.pendingText} numberOfLines={1}>
              {order.mechanic_name ?? 'Montir'} menunggu konfirmasimu
            </Text>
            <Text style={styles.pendingAction}>Konfirmasi</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { paddingHorizontal: ScreenPadding, paddingBottom: Space.xxxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.divider,
    paddingVertical: Space.md,
    marginTop: Space.xs,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { ...Type.h2, color: Brand.text },
  summaryLabel: { ...Type.meta, color: Brand.textMuted, marginTop: 1 },
  summaryDivider: { width: 1, height: 26, backgroundColor: Brand.divider },
  segmented: { marginTop: Space.md },
  group: { marginTop: Space.lg },
  groupLabel: {
    ...Type.micro,
    color: Brand.textMuted,
    marginBottom: Space.sm,
    textTransform: 'uppercase',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    marginBottom: Space.sm,
    overflow: 'hidden',
  },
  rail: { width: 3 },
  cardBody: { flex: 1, padding: Space.md },
  pressed: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusText: { fontSize: 10.5, fontWeight: '700' },
  time: { fontSize: 10.5, color: Brand.textMuted },
  issue: { ...Type.bodyStrong, color: Brand.text, marginTop: Space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaText: { flex: 1, fontSize: 11.5, color: Brand.textSecondary },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.sm,
  },
  price: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  priceMuted: { fontSize: 11, color: Brand.textMuted },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.xs,
    paddingHorizontal: Space.sm,
    paddingVertical: 7,
    marginTop: Space.sm,
  },
  pendingText: { flex: 1, fontSize: 11, fontWeight: '600', color: Brand.text },
  pendingAction: { fontSize: 11, fontWeight: '800', color: Brand.amber },
});
