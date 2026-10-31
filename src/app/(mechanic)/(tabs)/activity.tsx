import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { getActivityMeta } from '@/features/mechanic/constants';
import { listMyActivity, type ActivityItem } from '@/features/mechanic/service';
import { formatDateTime } from '@/utils/format';

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
            <View style={styles.card}>
              {items.map((item, index) => {
                const meta = getActivityMeta(item.activity_type);
                return (
                  <View
                    key={item.id}
                    style={[styles.row, index === items.length - 1 && styles.rowLast]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: meta.background }]}>
                      <Ionicons name={meta.icon} size={17} color={meta.color} />
                    </View>
                    <View style={styles.copy}>
                      <Text style={styles.title}>{meta.label}</Text>
                      {item.description ? (
                        <Text style={styles.description}>{item.description}</Text>
                      ) : null}
                      <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    paddingHorizontal: Space.lg,
  },
  row: {
    flexDirection: 'row',
    gap: Space.md,
    paddingVertical: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: '600', color: Brand.text },
  description: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
  time: { fontSize: 10.5, color: Brand.textMuted, marginTop: 3 },
});
