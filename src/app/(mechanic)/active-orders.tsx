import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { listMyOrders, type MyOrder } from '@/features/mechanic/service';
import { EmptyState, LoadingState } from '@/components/ui/state';

export default function MechanicActiveOrdersScreen() {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      setOrders(await listMyOrders(true));
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
        const rows = await listMyOrders(true);
        if (!cancelled) setOrders(rows);
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
    return <LoadingState message="Memuat order aktif..." />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Aktif</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListEmptyComponent={<EmptyState message="Belum ada order aktif saat ini." />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(mechanic)/active-order/${item.id}`)}>
            <Text style={styles.desc} numberOfLines={1}>{item.issue_description}</Text>
            <Text style={styles.muted}>{item.client_name ?? 'Client'} • {item.status.replaceAll('_', ' ')}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  muted: { fontSize: 13, color: '#60646c', marginTop: 4 },
  card: { backgroundColor: '#f5f5f7', borderRadius: 14, padding: 16, marginBottom: 12 },
  desc: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
});
