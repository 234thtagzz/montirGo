import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Tabular, Type } from '@/constants/brand';
import { getActivityMeta } from '@/features/mechanic/constants';
import {
  listMyActivity,
  listOrderInvoiceItems,
  type ActivityItem,
  type OrderInvoiceItem,
} from '@/features/mechanic/service';
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

  // Muat ulang setiap tab dibuka supaya aksi terbaru (mis. tiba di lokasi dan
  // tagihan terkirim) langsung terlihat tanpa harus pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * Buka/tutup rincian tagihan pada entri `invoice_sent`. Rincian diambil dari
   * `order_invoice_items` memakai `related_entity_id` (id service request) yang
   * disimpan saat montir mengirim tagihan.
   */
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
        // Rincian bersifat pelengkap; ringkasan aktivitas tetap ditampilkan.
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
          ) : items.length === 0 ? (
            <EmptyState
              icon="pulse-outline"
              message="Belum ada aktivitas"
              hint="Aktivitas seperti menerima order atau mengubah status akan tampil di sini."
            />
          ) : (
            <>
              <View style={styles.summary}>
                <View style={styles.summaryIcon}>
                  <Ionicons name="pulse-outline" size={17} color={Brand.primary} />
                </View>
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryTitle}>{items.length} catatan terbaru</Text>
                  <Text style={styles.summaryText}>
                    Order, pembayaran, dan status online tercatat otomatis.
                  </Text>
                </View>
              </View>

              {groups.map((group) => (
                <View key={group.key} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupLabel}>{group.label}</Text>
                    <View style={styles.groupLine} />
                  </View>

                  {group.items.map((item, index) => {
                    const meta = getActivityMeta(item.activity_type);
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
                          <View style={[styles.iconCircle, { backgroundColor: meta.background }]}>
                            <Ionicons name={meta.icon} size={16} color={meta.color} />
                          </View>
                          {!last ? <View style={styles.railLine} /> : null}
                        </View>
                        <View style={[styles.copy, !last && styles.copySpacing]}>
                          <View style={styles.titleRow}>
                            <Text style={styles.title}>{meta.label}</Text>
                            <View style={styles.titleRight}>
                              <Text style={[styles.time, Tabular]}>
                                {timeLabel(item.created_at)}
                              </Text>
                              {canExpand ? (
                                <Ionicons
                                  name={expanded ? 'chevron-up' : 'chevron-down'}
                                  size={14}
                                  color={Brand.textMuted}
                                />
                              ) : null}
                            </View>
                          </View>
                          {item.description ? (
                            <Text style={styles.description}>{item.description}</Text>
                          ) : null}

                          {canExpand ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={
                                expanded ? 'Sembunyikan rincian tagihan' : 'Lihat rincian tagihan'
                              }
                              onPress={() => toggleInvoiceDetail(item)}
                              style={({ pressed }) => [
                                styles.detailToggle,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text style={styles.detailToggleText}>
                                {expanded ? 'Sembunyikan rincian' : 'Lihat rincian tagihan'}
                              </Text>
                            </Pressable>
                          ) : null}

                          {canExpand && expanded ? (
                            <View style={styles.invoiceDetail}>
                              {detailLoadingId === item.id ? (
                                <Text style={styles.detailMuted}>Memuat rincian...</Text>
                              ) : detailRows.length === 0 ? (
                                <Text style={styles.detailMuted}>
                                  Rincian tagihan tidak tersedia.
                                </Text>
                              ) : (
                                <>
                                  {detailRows.map((row) => (
                                    <View key={row.id} style={styles.invoiceDetailRow}>
                                      <Text style={styles.invoiceDetailLabel} numberOfLines={2}>
                                        {row.keterangan}
                                      </Text>
                                      <Text style={[styles.invoiceDetailAmount, Tabular]}>
                                        {formatIDR(row.harga)}
                                      </Text>
                                    </View>
                                  ))}
                                  <View style={styles.invoiceDetailTotalRow}>
                                    <Text style={styles.invoiceDetailTotalLabel}>Total</Text>
                                    <Text style={[styles.invoiceDetailTotalValue, Tabular]}>
                                      {formatIDR(
                                        detailRows.reduce((sum, row) => sum + row.harga, 0),
                                      )}
                                    </Text>
                                  </View>
                                </>
                              )}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
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
  group: { marginTop: Space.xl },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.md, marginBottom: Space.md },
  groupLabel: { ...Type.micro, color: Brand.textMuted },
  groupLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: Brand.border },
  row: { flexDirection: 'row', gap: Space.md },
  rail: { width: 38, alignItems: 'center' },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLine: { flex: 1, width: 2, backgroundColor: Brand.border, marginTop: 4 },
  copy: { flex: 1, paddingTop: 2 },
  copySpacing: { paddingBottom: Space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
  titleRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700', flex: 1 },
  time: { ...Type.meta, color: Brand.textMuted, fontSize: 10 },
  description: { ...Type.meta, color: Brand.textSecondary, marginTop: 3, lineHeight: 17 },
  detailToggle: { marginTop: 6, alignSelf: 'flex-start' },
  detailToggleText: { ...Type.meta, color: Brand.primary, fontWeight: '700' },
  invoiceDetail: {
    marginTop: Space.sm,
    padding: Space.sm,
    borderRadius: Radius.sm,
    backgroundColor: Brand.background,
  },
  invoiceDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    paddingVertical: 3,
  },
  invoiceDetailLabel: { flex: 1, ...Type.meta, color: Brand.textSecondary },
  invoiceDetailAmount: { ...Type.meta, color: Brand.text, fontWeight: '700' },
  invoiceDetailTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
  },
  invoiceDetailTotalLabel: {
    ...Type.meta,
    color: Brand.textSecondary,
    fontWeight: '700',
  },
  invoiceDetailTotalValue: { ...Type.label, color: Brand.text, fontWeight: '800' },
  detailMuted: { ...Type.meta, color: Brand.textMuted },
  pressed: { opacity: 0.6 },
});
