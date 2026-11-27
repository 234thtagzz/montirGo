import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { ClientTripView } from '@/features/client/components/tracking/client-trip-view';
import { getRequest, type ClientOrder } from '@/features/client/service';
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useThemedStyles, type AppTheme } from '@/theme';

export default function ClientTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);

  const [order, setOrder] = useState<ClientOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setOrder(await getRequest(id));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRefreshOnForeground(() => {
    void load();
  });

  useEffect(() => {
    if (!id) return;
    const channel = createRealtimeChannel(`client-tracking-${id}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` },
      () => {
        void load();
      },
    );
    subscribeWithResync(channel, () => void load());
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const openDetail = useCallback(() => {
    if (!id) return;
    router.push({ pathname: '/(client)/orders/[id]', params: { id } });
  }, [id, router]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(client)/(tabs)');
  }, [router]);

  if (loading) {
    return (
      <View style={styles.fallback}>
        <LoadingState message="Menyiapkan perjalanan..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.fallback}>
        <ErrorState onRetry={load} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.fallback}>
        <EmptyState
          icon="map-outline"
          message="Perjalanan tidak ditemukan"
          hint="Order ini bukan milikmu atau sudah tidak aktif."
          actionLabel="Kembali ke Beranda"
          onPressAction={() => router.replace('/(client)/(tabs)')}
        />
      </View>
    );
  }

  if (order.status !== 'on_the_way') {
    const arrived = order.status === 'arrived';
    return (
      <View style={styles.fallback}>
        <EmptyState
          icon={arrived ? 'checkmark-circle-outline' : 'map-outline'}
          message={
            arrived
              ? 'Montir sudah tiba di lokasimu'
              : order.status === 'cancelled'
                ? 'Pesanan dibatalkan'
                : 'Perjalanan sudah selesai'
          }
          hint="Layar ini hanya aktif saat montir dalam perjalanan menuju lokasimu."
          actionLabel="Buka Detail Pesanan"
          onPressAction={() =>
            router.replace({ pathname: '/(client)/orders/[id]', params: { id: order.id } })
          }
        />
      </View>
    );
  }

  return <ClientTripView order={order} onBack={goBack} onOpenDetail={openDetail} />;
}

const createStyles = (theme: AppTheme) => ({
  fallback: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
    paddingTop: 60,
  },
});
