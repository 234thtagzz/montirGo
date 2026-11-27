import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { listMyRequests, type ClientOrder } from '@/features/client/service';
import { ComplaintBadge } from '@/features/complaints/components/complaint-badge';
import { listMyComplaintRequestIds } from '@/features/complaints/service';
import { getStatusMeta, isActiveStatus } from '@/features/service-request/status';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { useSessionUser } from '@/hooks/use-session-user';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDayLabel, formatTime } from '@/utils/format';

type FilterKey = 'all' | 'active' | 'done' | 'cancelled';

const FILTERS: SegmentedOption<FilterKey>[] = [
  { value: 'all', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'done', label: 'Selesai' },
  { value: 'cancelled', label: 'Batal' },
];

type RequestListItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'order'; key: string; order: ClientOrder };

export default function MyRequestsScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useSessionUser();
  const router = useRouter();

  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [complaintIds, setComplaintIds] = useState<Set<string>>(new Set());
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
    void listMyComplaintRequestIds()
      .then((ids) => setComplaintIds(new Set(ids)))
      .catch(() => setComplaintIds(new Set()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRefreshOnForeground(load);

  useEffect(() => {
    if (!user?.id) return;
    const channel = createRealtimeChannel(`client-orders-${user.id}`).on(
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

  const counts = useMemo(
    () => ({
      active: orders.filter((order) => isActiveStatus(order.status)).length,
      done: orders.filter((order) => order.status === 'paid').length,
      total: orders.length,
    }),
    [orders],
  );

  const listItems = useMemo<RequestListItem[]>(() => {
    const visible = orders.filter((order) => {
      if (filter === 'active') return isActiveStatus(order.status);
      if (filter === 'done') return order.status === 'paid';
      if (filter === 'cancelled') return order.status === 'cancelled';
      return true;
    });

    const out: RequestListItem[] = [];
    let currentLabel = '';
    for (const order of visible) {
      const label = formatDayLabel(order.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        out.push({ kind: 'header', key: `hdr-${label}`, label });
      }
      out.push({ kind: 'order', key: order.id, order });
    }
    return out;
  }, [orders, filter]);

  const headerComponent = (
    <View style={styles.listHeader}>
      <Surface variant="default" padding="none" style={styles.summary}>
        <SummaryStat label="Total" value={counts.total} />
        <View style={styles.summaryDivider} />
        <SummaryStat label="Aktif" value={counts.active} tone="info" />
        <View style={styles.summaryDivider} />
        <SummaryStat label="Selesai" value={counts.done} tone="success" />
      </Surface>

      <Segmented
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        style={styles.segmented}
      />

      {error ? <ErrorState onRetry={load} /> : null}
    </View>
  );

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
        <FlatList
          data={error ? [] : listItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={headerComponent}
          ListEmptyComponent={
            !error ? (
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
            ) : undefined
          }
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
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <AppText variant="overline" tone="muted" style={styles.groupLabel}>
                  {item.label}
                </AppText>
              );
            }
            return (
              <OrderRow
                order={item.order}
                hasComplaint={complaintIds.has(item.order.id)}
                onPress={() =>
                  router.push({
                    pathname: '/(client)/orders/[id]',
                    params: { id: item.order.id },
                  })
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}

function SummaryStat({
  label,
  value,
  tone = 'primary',
}: {
  label: string;
  value: number;
  tone?: 'primary' | 'info' | 'success';
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.summaryItem}>
      <AppText variant="h2" tone={tone} style={theme.tabularNums}>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function OrderRow({
  order,
  onPress,
  hasComplaint,
}: {
  order: ClientOrder;
  onPress: () => void;
  hasComplaint?: boolean;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const meta = getStatusMeta(order.status);
  const tonePalette = theme.tones[meta.tone];
  const pendingConfirmation =
    order.status === 'mechanic_assigned' && Boolean(order.mechanic_id);
  const isCalloutOnly = order.quote_status === 'callout_only';
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
      style={({ pressed }) => [styles.card, theme.elevation.card, pressed && styles.pressed]}
    >
      <View style={[styles.rail, { backgroundColor: tonePalette.fg }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Badge label={meta.shortLabel} tone={meta.tone} icon={meta.icon} size="sm" />
          <AppText variant="caption" tone="muted" style={theme.tabularNums}>
            {formatTime(order.created_at)}
          </AppText>
        </View>

        {hasComplaint || isCalloutOnly ? (
          <View style={styles.badgeRow}>
            {hasComplaint ? <ComplaintBadge /> : null}
            {isCalloutOnly ? (
              <Badge label="Biaya panggil saja" tone="neutral" size="sm" />
            ) : null}
          </View>
        ) : null}

        <AppText variant="title" style={styles.issue} numberOfLines={2}>
          {order.issue_description}
        </AppText>

        <View style={styles.metaRow}>
          <Ionicons name="car-outline" size={14} color={theme.colors.textMuted} />
          <AppText variant="caption" tone="secondary" style={styles.flexCopy} numberOfLines={1}>
            {vehicle || 'Kendaraan tidak dicantumkan'}
          </AppText>
        </View>

        <View style={styles.cardBottom}>
          {order.price_amount != null ? (
            <View style={styles.priceWrap}>
              <AppText variant="overline" tone="muted">
                BIAYA
              </AppText>
              <Money value={order.price_amount} size="sm" color={theme.colors.textPrimary} />
            </View>
          ) : (
            <AppText variant="caption" tone="muted">
              Biaya panggil {formatTime(order.created_at) ? 'pasti aktif' : ''}
            </AppText>
          )}
          <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
        </View>

        {pendingConfirmation ? (
          <View style={styles.pendingRow}>
            <Ionicons name="person-add-outline" size={14} color={theme.colors.statusWarningFg} />
            <AppText variant="caption" style={styles.flexCopy} numberOfLines={1}>
              {order.mechanic_name ?? 'Montir'} menunggu konfirmasimu
            </AppText>
            <AppText variant="label" tone="warning">
              Konfirmasi
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xxxl,
  },
  listHeader: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  summary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center' as const,
    gap: theme.spacing.xxs,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.borderSubtle,
  },
  segmented: {
    marginBottom: theme.spacing.xs,
  },
  groupLabel: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase' as const,
  },
  card: {
    flexDirection: 'row' as const,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginBottom: theme.spacing.md,
    overflow: 'hidden' as const,
  },
  rail: { width: 4 },
  badgeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  cardBody: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  pressed: { opacity: 0.78 },
  cardTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  issue: {
    marginTop: theme.spacing.md,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  flexCopy: { flex: 1 },
  cardBottom: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  priceWrap: {
    gap: theme.spacing.xxs,
  },
  pendingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
});
