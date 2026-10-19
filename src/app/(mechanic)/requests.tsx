import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, ScreenPadding, Space } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import { acceptOrder, listIncomingOrders, type IncomingOrder } from '@/features/mechanic/service';
import { OrderCard } from '@/features/mechanic/components/order-card';

const NEW_REQUEST_BADGE = {
  label: 'Request baru',
  color: Brand.amber,
  background: Brand.amberSoft,
  icon: 'flash-outline' as const,
};

export default function MechanicRequestsScreen() {
  const [orders, setOrders] = useState<IncomingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      setOrders(await listIncomingOrders());
      setError(false);
    } catch {
      setError(true);
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
        if (!cancelled) {
          setOrders(rows);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
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
      Alert.alert('Berhasil', 'Order diterima. Lihat detailnya di Beranda > Order aktif.', [
        { text: 'Nanti' },
        { text: 'Lihat Order', onPress: () => router.push(`/(mechanic)/active-order/${id}`) },
      ]);
      load();
    } catch (e) {
      Alert.alert(
        'Gagal menerima',
        e instanceof Error ? e.message : 'Order mungkin sudah diambil montir lain.',
      );
      load();
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader
          title="Request Masuk"
          subtitle="Permintaan client di sekitarmu"
          showBack={false}
        />
        <LoadingState message="Mencari request masuk..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Request Masuk"
        subtitle="Permintaan client di sekitarmu"
        showBack={false}
      />
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
        ) : orders.length === 0 ? (
          <EmptyState
            icon="flash-outline"
            message="Belum ada request masuk"
            hint="Pastikan status kamu Online di Beranda supaya client bisa menemukanmu."
            actionLabel="Buka Beranda"
            onPressAction={() => router.push('/(mechanic)')}
          />
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              issue={order.issue_description}
              status={order.status}
              createdAt={order.created_at}
              vehicle={[order.vehicle_brand, order.vehicle_model].filter(Boolean).join(' ')}
              clientName={order.client_name}
              address={order.address}
              badge={NEW_REQUEST_BADGE}
              action={{
                label: acceptingId === order.id ? 'Memproses...' : 'Terima Order',
                icon: 'checkmark-circle-outline',
                loading: acceptingId === order.id,
                onPress: () => handleAccept(order.id),
              }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
});
