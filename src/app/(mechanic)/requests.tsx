import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
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

  // Muat ulang setiap layar difokuskan (mis. kembali dari detail request).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_diagnoses' }, load)
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
      // Request langsung hilang dari daftar semua montir...
      setOrders((current) => current.filter((order) => order.id !== id));
      Alert.alert(
        'Order diterima',
        'Request sudah berpindah ke Beranda sebagai order aktifmu.',
        [
          {
            text: 'Lihat Beranda',
            onPress: () => router.replace('/(mechanic)'),
          },
        ],
        { cancelable: false },
      );
      load();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Order mungkin sudah diambil montir lain.';
      Alert.alert('Gagal menerima', message);
      // Hanya hilangkan dari daftar bila request memang sudah tidak tersedia.
      if (/diambil montir lain|tidak tersedia/i.test(message)) {
        setOrders((current) => current.filter((order) => order.id !== id));
      }
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
            hint="Request client yang masih terbuka akan muncul di sini. Setelah kamu terima, request pindah ke Beranda sebagai order aktif."
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
              aiRisk={order.ai_risk_level}
              badge={NEW_REQUEST_BADGE}
              onPress={() =>
                router.push({
                  pathname: '/(mechanic)/request/[id]',
                  params: { id: order.id },
                })
              }
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
