import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { listMyActivity, type ActivityItem } from '@/features/mechanic/service';
import { formatDateTime } from '@/utils/format';
import { EmptyState, LoadingState } from '@/components/ui/state';

const ACTIVITY_LABEL: Record<string, string> = {
  online_status: 'Status online',
  order_accepted: 'Order diterima',
  order_status: 'Update order',
  login: 'Login',
};

export default function MechanicActivityScreen() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listMyActivity());
    } catch (e) {
      Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMyActivity();
        if (!cancelled) setItems(rows);
      } catch (e) {
        if (!cancelled) Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Coba lagi.');
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

  if (loading) {
    return <LoadingState message="Memuat aktivitas..." />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Aktivitas</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListEmptyComponent={<EmptyState message="Belum ada aktivitas tercatat." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.dot} />
            <View style={styles.body}>
              <Text style={styles.type}>{ACTIVITY_LABEL[item.activity_type] ?? item.activity_type}</Text>
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
              <Text style={styles.time}>{formatDateTime(item.created_at)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  muted: { fontSize: 13, color: '#60646c' },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3c87f7', marginTop: 5 },
  body: { flex: 1 },
  type: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  desc: { fontSize: 13, color: '#60646c', marginTop: 2 },
  time: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
});
