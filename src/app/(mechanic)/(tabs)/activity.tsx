import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Tabular, Type } from '@/constants/brand';
import { getActivityMeta } from '@/features/mechanic/constants';
import { listMyActivity, type ActivityItem } from '@/features/mechanic/service';

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
                            <Text style={[styles.time, Tabular]}>{timeLabel(item.created_at)}</Text>
                          </View>
                          {item.description ? (
                            <Text style={styles.description}>{item.description}</Text>
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
  title: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700', flex: 1 },
  time: { ...Type.meta, color: Brand.textMuted, fontSize: 10 },
  description: { ...Type.meta, color: Brand.textSecondary, marginTop: 3, lineHeight: 17 },
});
