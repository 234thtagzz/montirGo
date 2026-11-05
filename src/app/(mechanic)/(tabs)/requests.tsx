import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { createRealtimeChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import {
  acceptOrder,
  ACTIVE_ORDER_MESSAGE,
  getMyActiveOrderId,
  listIncomingOrders,
  type IncomingOrder,
} from '@/features/mechanic/service';
import { OrderCard } from '@/features/mechanic/components/order-card';
import { formatVehicleLabel } from '@/features/vehicles/constants';
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
    const ch = createRealtimeChannel('mechanic-incoming')
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
        'Pengajuan terkirim',
        'Client akan meninjau profilmu dan mengonfirmasi dalam 5 menit. Request pindah ke Beranda sebagai pengajuan menunggu konfirmasi.',
        [
          {
            text: 'Lihat Pengajuan',
            onPress: () =>
              router.replace({
                pathname: '/(mechanic)/active-order/[id]',
                params: { id },
              }),
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
        <ScreenHeader title="Request Masuk" showBack={false} />
        <LoadingState message="Mencari request masuk..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Request Masuk"
        subtitle={
          orders.length > 0
            ? `${orders.length} request terbuka di sekitarmu`
            : 'Permintaan client di sekitarmu'
        }
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
        <View style={styles.liveStrip}>
          <View style={styles.liveLeft}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Memantau request baru secara realtime</Text>
          </View>
          <Ionicons name="radio-outline" size={16} color={Brand.textMuted} />
        </View>

        {activeOrderId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka order aktif yang sedang berjalan"
            onPress={() => router.push(`/(mechanic)/active-order/${activeOrderId}`)}
            style={({ pressed }) => [styles.lockCard, pressed && styles.pressed]}
          >
            <View style={styles.lockIcon}>
              <Ionicons name="lock-closed" size={15} color={Brand.amber} />
            </View>
            <View style={styles.lockCopy}>
              <Text style={styles.lockTitle}>Selesaikan order aktif dulu</Text>
              <Text style={styles.lockText}>
                Satu montir hanya memegang satu order. Request baru bisa diambil setelah order #
                {activeOrderId.slice(0, 8).toUpperCase()} lunas.
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
          <>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>TERBUKA</Text>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{orders.length}</Text>
              </View>
            </View>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                issue={order.issue_description}
                status={order.status}
                createdAt={order.created_at}
                vehicle={formatVehicleLabel(
                  order.vehicle_type,
                  order.vehicle_brand,
                  order.vehicle_model,
                )}
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
                      : 'Ajukan ke Client',
                  icon: 'paper-plane-outline',
                  loading: acceptingId === order.id,
                  disabled: activeOrderId != null,
                  onPress: () => handleAccept(order.id),
                }}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { paddingHorizontal: ScreenPadding, paddingBottom: Space.xxxl },
  liveStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
    marginBottom: Space.md,
  },
  liveLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.green },
  liveText: { ...Type.meta, color: Brand.textSecondary },
  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginBottom: Space.md,
  },
  lockIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCopy: { flex: 1 },
  lockTitle: { ...Type.label, color: Brand.text, fontWeight: '700' },
  lockText: { ...Type.meta, color: '#7C5A12', marginTop: 2, lineHeight: 15 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Space.sm,
    marginBottom: Space.md,
  },
  listTitle: { ...Type.micro, color: Brand.textMuted, letterSpacing: 1 },
  countPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: { ...Type.micro, color: Brand.primary, fontSize: 9.5 },
  pressed: { opacity: 0.8 },
});
