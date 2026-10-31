import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import {
  acceptOrder,
  ACTIVE_ORDER_MESSAGE,
  getMyActiveOrderId,
  listIncomingOrders,
  type IncomingOrder,
} from '@/features/mechanic/service';
import { OrderCard } from '@/features/mechanic/components/order-card';
import { MechanicNotificationBell } from '@/features/notifications/components/notification-bell';

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
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [rows, activeId] = await Promise.all([
        listIncomingOrders(),
        getMyActiveOrderId().catch(() => null),
      ]);
      setOrders(rows);
      setActiveOrderId(activeId);
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

  // Realtime: request baru/berubah langsung menyegarkan daftar. Pemuatan awal
  // sudah ditangani `useFocusEffect` di atas.
  useEffect(() => {
    const ch = supabase
      .channel('mechanic-incoming')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_diagnoses' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const handleAccept = async (id: string) => {
    if (activeOrderId) {
      Alert.alert('Masih ada order aktif', ACTIVE_ORDER_MESSAGE, [
        { text: 'Tutup', style: 'cancel' },
        {
          text: 'Buka Order Aktif',
          onPress: () => router.push(`/(mechanic)/active-order/${activeOrderId}`),
        },
      ]);
      return;
    }
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
            onPress: () => router.replace('/(mechanic)/(tabs)'),
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
        right={<MechanicNotificationBell />}
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
        {activeOrderId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka order aktif yang sedang berjalan"
            onPress={() => router.push(`/(mechanic)/active-order/${activeOrderId}`)}
            style={({ pressed }) => [styles.lockCard, pressed && styles.pressed]}
          >
            <Ionicons name="lock-closed-outline" size={18} color={Brand.amber} />
            <View style={styles.lockCopy}>
              <Text style={styles.lockTitle}>Selesaikan order aktif dulu</Text>
              <Text style={styles.lockText}>
                Satu montir hanya memegang satu order. Request baru bisa diambil
                setelah order #{activeOrderId.slice(0, 8).toUpperCase()} lunas.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Brand.amber} />
          </Pressable>
        ) : null}

        {error ? (
          <ErrorState onRetry={load} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon="flash-outline"
            message="Belum ada request masuk"
            hint="Request client yang masih terbuka akan muncul di sini. Setelah kamu terima, request pindah ke Beranda sebagai order aktif."
            actionLabel="Buka Beranda"
            onPressAction={() => router.push('/(mechanic)/(tabs)')}
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
                label: activeOrderId
                  ? 'Selesaikan Order Dulu'
                  : acceptingId === order.id
                    ? 'Memproses...'
                    : 'Terima Order',
                icon: 'checkmark-circle-outline',
                loading: acceptingId === order.id,
                disabled: activeOrderId != null,
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
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginBottom: Space.md,
  },
  lockCopy: { flex: 1 },
  lockTitle: { fontSize: 13, fontWeight: '700', color: Brand.text },
  lockText: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
  pressed: { opacity: 0.8 },
});
