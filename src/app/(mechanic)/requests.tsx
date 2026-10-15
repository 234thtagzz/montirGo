import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, FlatList, RefreshControl, Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { acceptOrder, listIncomingOrders, type IncomingOrder } from '@/features/mechanic/service';
import { EmptyState, LoadingState } from '@/components/ui/state';

export default function MechanicRequestsScreen() {
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders(await listIncomingOrders());
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
        const rows = await listIncomingOrders();
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
    const ch = supabase
      .channel('mechanic-incoming')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_requests' }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [load]);

  const handleAccept = async (id: string) => {
    setAcceptingId(id);
    try {
      await acceptOrder(id);
      Alert.alert('Berhasil', 'Order diterima. Lihat di Dashboard > Order Aktif.');
      load();
    } catch (e) {
      Alert.alert('Gagal menerima', e instanceof Error ? e.message : 'Order mungkin sudah diambil montir lain.');
      load();
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return <LoadingState message="Mencari request masuk..." />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Request Masuk</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListEmptyComponent={
          <EmptyState message="Belum ada request. Pastikan status kamu Online di Dashboard." />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.desc} numberOfLines={2}>{item.issue_description}</Text>
            <Text style={styles.muted}>
              {[item.vehicle_brand, item.vehicle_model].filter(Boolean).join(' ') || 'Kendaraan'}
              {' • '}{item.client_name ?? 'Client'}
            </Text>
            {item.address ? <Text style={styles.muted}>{item.address}</Text> : null}
            <Pressable
              style={[styles.button, acceptingId === item.id && styles.buttonDisabled]}
              disabled={acceptingId === item.id}
              onPress={() => handleAccept(item.id)}>
              <Text style={styles.buttonText}>
                {acceptingId === item.id ? 'Memproses...' : 'Terima Order'}
              </Text>
            </Pressable>
          </View>
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
  button: { backgroundColor: '#16a34a', padding: 13, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
