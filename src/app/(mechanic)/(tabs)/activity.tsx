import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { getActivityMeta } from '@/features/mechanic/constants';
import {
  listMyActivity,
  listOrderInvoiceItems,
  type ActivityItem,
  type OrderInvoiceItem,
} from '@/features/mechanic/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(iso) === dayKey(today.toISOString())) return 'Hari ini';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return 'Kemarin';
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface DayGroup {
  key: string;
  label: string;
  items: ActivityItem[];
}

export default function MechanicActivityScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [invoiceItemsByRequest, setInvoiceItemsByRequest] = useState<
    Record<string, OrderInvoiceItem[]>
  >({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listMyActivity());
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
      void load();
    }, [load]),
  );

  const toggleInvoiceDetail = useCallback(
    async (item: ActivityItem) => {
      if (item.activity_type !== 'invoice_sent' || !item.related_entity_id) return;
      const requestId = item.related_entity_id;
      setExpandedId((prev) => (prev === item.id ? null : item.id));
      if (invoiceItemsByRequest[requestId]) return;

      setDetailLoadingId(item.id);
      try {
        const rows = await listOrderInvoiceItems(requestId);
        setInvoiceItemsByRequest((prev) => ({ ...prev, [requestId]: rows }));
      } catch {
        // Rincian bersifat pelengkap; ringkasan aktivitas tetap tampil.
      } finally {
        setDetailLoadingId(null);
      }
    },
    [invoiceItemsByRequest],
  );

  const groups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const item of items) {
      const key = dayKey(item.created_at);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, { key, label: dayLabel(item.created_at), items: [item] });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const listHeader =
    !error && items.length > 0 ? (
      <Surface variant="default" padding="md" style={styles.summary}>
        <View style={styles.summaryIcon}>
          <Ionicons
            name="pulse-outline"
            size={18}
            color={theme.colors.statusInfoFg}
          />
        </View>
        <View style={styles.summaryCopy}>
          <AppText variant="bodyStrong">{items.length} catatan terbaru</AppText>
          <AppText variant="caption" tone="secondary">
            Order, estimasi, pembayaran, dan status siaga tercatat otomatis.
          </AppText>
        </View>
      </Surface>
    ) : undefined;

  const emptyContent = error ? (
    <ErrorState onRetry={() => void load()} />
  ) : (
    <EmptyState
      icon="pulse-outline"
      message="Belum ada aktivitas"
      hint="Aktivitas seperti menerima order atau mengubah status akan tampil di sini."
    />
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Aktivitas"
        subtitle="Jejak aktivitas akun montirmu"
        showBack={false}
      />
      {loading ? (
        <LoadingState message="Memuat aktivitas..." />
      ) : (
        <FlatList
          data={error ? [] : groups}
          keyExtractor={(group) => group.key}
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
          renderItem={({ item: group }) => (
            <View style={styles.group}>
              <View style={styles.groupHeader}>
                <AppText variant="overline" tone="muted">
                  {group.label}
                </AppText>
                <View style={styles.groupLine} />
              </View>

              {group.items.map((item, index) => {
                const meta = getActivityMeta(item.activity_type);
                const tonePalette = theme.tones[meta.tone];
                const last = index === group.items.length - 1;
                const canExpand =
                  item.activity_type === 'invoice_sent' &&
                  Boolean(item.related_entity_id);
                const expanded = expandedId === item.id;
                const detailRows = item.related_entity_id
                  ? invoiceItemsByRequest[item.related_entity_id] ?? []
                  : [];

                return (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rail}>
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: tonePalette.bg },
                        ]}
                      >
                        <Ionicons
                          name={meta.icon}
                          size={17}
                          color={tonePalette.fg}
                        />
                      </View>
                      {!last ? <View style={styles.railLine} /> : null}
                    </View>
                    <View style={[styles.copy, !last && styles.copySpacing]}>
                      <View style={styles.titleRow}>
                        <AppText variant="bodyStrong" style={styles.title}>
                          {meta.label}
                        </AppText>
                        <View style={styles.titleRight}>
                          <AppText variant="caption" tone="muted" tabular>
                            {timeLabel(item.created_at)}
                          </AppText>
                          {canExpand ? (
                            <Ionicons
                              name={expanded ? 'chevron-up' : 'chevron-down'}
                              size={14}
                              color={theme.colors.textMuted}
                            />
                          ) : null}
                        </View>
                      </View>
                      {item.description ? (
                        <AppText variant="caption" tone="secondary">
                          {item.description}
                        </AppText>
                      ) : null}

                      {canExpand ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            expanded
                              ? 'Sembunyikan rincian tagihan'
                              : 'Lihat rincian tagihan'
                          }
                          onPress={() => void toggleInvoiceDetail(item)}
                          style={({ pressed }) => [
                            styles.detailToggle,
                            pressed && styles.pressed,
                          ]}
                        >
                          <AppText variant="label" tone="info">
                            {expanded
                              ? 'Sembunyikan rincian'
                              : 'Lihat rincian tagihan'}
                          </AppText>
                        </Pressable>
                      ) : null}

                      {canExpand && expanded ? (
                        <Surface variant="subtle" padding="md" style={styles.invoiceDetail}>
                          {detailLoadingId === item.id ? (
                            <AppText variant="caption" tone="muted">
                              Memuat rincian…
                            </AppText>
                          ) : detailRows.length === 0 ? (
                            <AppText variant="caption" tone="muted">
                              Rincian tagihan tidak tersedia.
                            </AppText>
                          ) : (
                            <>
                              {detailRows.map((row) => (
                                <View key={row.id} style={styles.invoiceDetailRow}>
                                  <AppText
                                    variant="caption"
                                    tone="secondary"
                                    numberOfLines={2}
                                    style={styles.invoiceDetailLabel}
                                  >
                                    {row.description}
                                  </AppText>
                                  <AppText variant="label" tabular>
                                    {formatIDR(row.amount)}
                                  </AppText>
                                </View>
                              ))}
                              <View style={styles.invoiceDetailTotalRow}>
                                <AppText variant="label" tone="secondary">
                                  Total
                                </AppText>
                                <AppText variant="label" tabular>
                                  {formatIDR(
                                    detailRows.reduce(
                                      (sum, row) => sum + row.amount,
                                      0,
                                    ),
                                  )}
                                </AppText>
                              </View>
                            </>
                          )}
                        </Surface>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
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
  group: {
    marginTop: theme.spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  groupLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
  },
  row: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
  },
  rail: {
    width: 40,
    alignItems: 'center' as const,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  railLine: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.borderSubtle,
    marginTop: theme.spacing.xs,
  },
  copy: {
    flex: 1,
    paddingTop: 2,
    gap: theme.spacing.xxs,
  },
  copySpacing: {
    paddingBottom: theme.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  titleRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  title: {
    flex: 1,
  },
  detailToggle: {
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-start' as const,
  },
  invoiceDetail: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  invoiceDetailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  invoiceDetailLabel: {
    flex: 1,
  },
  invoiceDetailTotalRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xxs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  pressed: {
    opacity: 0.65,
  },
});
