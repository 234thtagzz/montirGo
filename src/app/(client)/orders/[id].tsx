import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, ScreenPadding, Space } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import {
  cancelServiceRequest,
  getRequest,
  listStatusHistory,
  type ClientOrder,
  type OrderStatusEvent,
} from '@/features/client/service';
import {
  analyzeRequest,
  getRequestAnalysis,
  type AiAnalysis,
} from '@/features/service-request/ai';
import {
  createPaymentSession,
  getPaymentForRequest,
  syncPaymentStatus,
  type OrderPayment,
} from '@/features/finance/service';
import { AiAnalysisCard } from '@/features/service-request/components/ai-analysis-card';
import {
  getProgressLabel,
  getStatusMeta,
  isCancellable,
  TOTAL_STEPS,
} from '@/features/service-request/status';
import { formatDateTime, formatIDR } from '@/utils/format';
import { openWhatsApp } from '@/utils/whatsapp';

export default function ClientOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<ClientOrder | null>(null);
  const [history, setHistory] = useState<OrderStatusEvent[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [payment, setPayment] = useState<OrderPayment | null>(null);
  const [paying, setPaying] = useState(false);

  const loadAnalysis = useCallback(async () => {
    if (!id) return;
    try {
      setAnalysis(await getRequestAnalysis(id));
      setAnalysisError(null);
    } catch {
      setAnalysisError('Analisis AI gagal dimuat. Periksa koneksi lalu coba lagi.');
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, events] = await Promise.all([
        getRequest(id),
        listStatusHistory(id),
      ]);
      setOrder(detail);
      setHistory(events);
      setPayment(await getPaymentForRequest(id).catch(() => null));
      setError(false);
      await loadAnalysis();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, loadAnalysis]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime: detail mengikuti perubahan status dari montir + hasil analisis AI.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`client-order-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `request_id=eq.${id}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_diagnoses', filter: `request_id=eq.${id}` },
        () => loadAnalysis(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load, loadAnalysis]);

  const retryAnalysis = async () => {
    if (!id || analyzing) return;
    setAnalyzing(true);
    try {
      await analyzeRequest(id);
      await loadAnalysis();
    } catch (e) {
      setAnalysisError(
        e instanceof Error ? e.message : 'Analisis AI gagal. Coba lagi beberapa saat lagi.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Cek status pembayaran langsung ke Xendit (bukan mengandalkan webhook saja).
   * Mengembalikan true bila order sudah lunas dan UI sudah dimuat ulang.
   */
  const checkPayment = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    try {
      const result = await syncPaymentStatus(id);
      if (result.status === 'paid') {
        await load();
        return true;
      }
    } catch {
      // Gagal sementara (offline / Xendit timeout) — polling berikutnya mencoba lagi.
    }
    return false;
  }, [id, load]);

  // Selama tagihan belum lunas, sinkronkan berkala agar status berubah walau
  // webhook Xendit belum/tidak terkirim ke server.
  useEffect(() => {
    if (!id || order?.status !== 'payment' || !payment?.payment_session_id) return;
    let active = true;
    const tick = async () => {
      const paid = await checkPayment();
      if (!active || paid) return;
    };
    void tick();
    const timer = setInterval(tick, 7000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, order?.status, payment?.payment_session_id, checkPayment]);

  const confirmCancel = () => {
    Alert.alert('Batalkan pesanan?', 'Montir tidak akan datang jika pesanan dibatalkan.', [
      { text: 'Tidak', style: 'cancel' },
      {
        text: 'Ya, batalkan',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          setCancelling(true);
          try {
            await cancelServiceRequest(id);
            await load();
          } catch (cancelError) {
            Alert.alert(
              'Gagal membatalkan',
              cancelError instanceof Error ? cancelError.message : 'Coba lagi.',
            );
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const chatMechanic = () => {
    if (!order) return;
    void openWhatsApp(
      order.mechanic_phone,
      `Halo, saya client MontirGo terkait pesanan #${order.id.slice(0, 8).toUpperCase()}.`,
    );
  };

  const payOrder = async () => {
    if (!id || paying) return;
    setPaying(true);
    try {
      const session = await createPaymentSession(id);
      if (session.alreadyPaid) {
        await load();
        Alert.alert('Sudah lunas', 'Pembayaran order ini sudah diterima.');
        return;
      }
      await openBrowserAsync(session.paymentUrl);
      // Setelah kembali dari halaman checkout, minta server memeriksa status
      // ke Xendit, lalu muat ulang. Polling di atas melanjutkan bila belum lunas.
      await syncPaymentStatus(id).catch(() => null);
      await load();
    } catch (e) {
      Alert.alert(
        'Gagal membuka pembayaran',
        e instanceof Error ? e.message : 'Coba lagi beberapa saat lagi.',
      );
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Pesanan" />
        <LoadingState message="Memuat pesanan..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Pesanan" />
        <ErrorState onRetry={load} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Pesanan" />
        <EmptyState
          icon="receipt-outline"
          message="Pesanan tidak ditemukan"
          hint="Pesanan mungkin sudah dihapus atau bukan milik akun ini."
          actionLabel="Kembali ke Beranda"
          onPressAction={() => router.replace('/(client)/(tabs)')}
        />
      </View>
    );
  }

  const meta = getStatusMeta(order.status);
  const vehicle = [order.vehicle_brand, order.vehicle_model].filter(Boolean).join(' ');

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Detail Pesanan"
        subtitle={`#${order.id.slice(0, 8).toUpperCase()}`}
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
        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View style={[styles.chip, { backgroundColor: meta.background }]}>
              <Ionicons name={meta.icon} size={13} color={meta.color} />
              <Text style={[styles.chipText, { color: meta.color }]}>{meta.shortLabel}</Text>
            </View>
            <Text style={styles.statusTime}>{formatDateTime(order.created_at)}</Text>
          </View>
          <Text style={styles.statusTitle}>{getProgressLabel(order.status)}</Text>
          <Text style={styles.statusSub}>{meta.label}</Text>

          {meta.step > 0 ? (
            <View style={styles.progress}>
              {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                <View
                  key={index}
                  style={[styles.segment, index < meta.step && styles.segmentActive]}
                />
              ))}
            </View>
          ) : null}
        </View>

        {order.mechanic_id ? (
          <View style={styles.mechanicCard}>
            <Avatar name={order.mechanic_name ?? 'Montir'} uri={order.mechanic_avatar} size={46} />
            <View style={styles.mechanicCopy}>
              <Text style={styles.mechanicName} numberOfLines={1}>
                {order.mechanic_name ?? 'Montir MontirGo'}
              </Text>
              <Text style={styles.mechanicRole}>Montir yang menangani pesananmu</Text>
            </View>
            {order.mechanic_phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hubungi montir lewat WhatsApp"
                onPress={chatMechanic}
                style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
              >
                <Ionicons name="logo-whatsapp" size={18} color={Brand.white} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.searchingCard}>
            <Ionicons name="search-outline" size={18} color={Brand.amber} />
            <Text style={styles.searchingText}>
              Pesananmu sedang dicari montir terdekat. Kamu akan menerima notifikasi saat montir
              menerima pesanan.
            </Text>
          </View>
        )}

        {order.status === 'payment' || order.status === 'paid' ? (
          <>
            <Text style={styles.section}>Pembayaran</Text>
            <View style={styles.paymentCard}>
              <View style={styles.paymentTop}>
                <View>
                  <Text style={styles.paymentLabel}>Total tagihan</Text>
                  <Text style={styles.paymentAmount}>
                    {formatIDR(order.price_amount ?? payment?.amount ?? 0)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.paymentBadge,
                    order.status === 'paid' ? styles.paymentBadgePaid : styles.paymentBadgePending,
                  ]}
                >
                  <Text
                    style={[
                      styles.paymentBadgeText,
                      order.status === 'paid'
                        ? styles.paymentBadgeTextPaid
                        : styles.paymentBadgeTextPending,
                    ]}
                  >
                    {order.status === 'paid' ? 'Lunas' : 'Belum dibayar'}
                  </Text>
                </View>
              </View>

              {order.status === 'paid' ? (
                <View style={styles.paymentStatusRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Brand.green} />
                  <Text style={styles.paymentStatusText}>
                    Pembayaran diterima
                    {payment?.paid_at ? ` · ${formatDateTime(payment.paid_at)}` : ''}.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.paymentHint}>
                    Bayar dengan QRIS, GoPay, OVO, DANA, atau ShopeePay di halaman aman Xendit.
                    Status pesanan diperbarui otomatis setelah pembayaran berhasil.
                  </Text>
                  {payment?.expires_at ? (
                    <Text style={styles.paymentMeta}>
                      Link pembayaran berlaku sampai {formatDateTime(payment.expires_at)}
                    </Text>
                  ) : null}
                  <Button
                    label="Bayar Sekarang"
                    icon="card-outline"
                    loading={paying}
                    onPress={payOrder}
                    style={styles.payButton}
                  />
                </>
              )}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Detail permintaan</Text>
        <View style={styles.detailCard}>
          <DetailRow label="Keluhan" value={order.issue_description} />
          {order.symptoms ? <DetailRow label="Gejala" value={order.symptoms} /> : null}
          <DetailRow label="Kendaraan" value={vehicle || 'Tidak dicantumkan'} />
          {order.vehicle_plate ? <DetailRow label="Nomor polisi" value={order.vehicle_plate} /> : null}
          <DetailRow label="Lokasi" value={order.address || 'Lokasi GPS terdeteksi'} />
          <DetailRow label="WhatsApp" value={order.contact_phone} />
          {order.additional_notes ? (
            <DetailRow label="Catatan" value={order.additional_notes} />
          ) : null}
          {order.price_amount != null ? (
            <DetailRow label="Biaya" value={formatIDR(order.price_amount)} highlight />
          ) : null}
        </View>

        <Text style={styles.section}>Analisis AI</Text>
        <AiAnalysisCard
          analysis={analysis}
          error={analysisError}
          retrying={analyzing}
          onRetry={
            order.status !== 'cancelled' && order.status !== 'paid' ? retryAnalysis : undefined
          }
        />

        {history.length > 0 ? (
          <>
            <Text style={styles.section}>Riwayat status</Text>
            <View style={styles.detailCard}>
              {history.map((event, index) => {
                const eventMeta = getStatusMeta(event.to_status);
                return (
                  <View key={event.id} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, { backgroundColor: eventMeta.color }]} />
                      {index < history.length - 1 ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={styles.timelineCopy}>
                      <Text style={styles.timelineTitle}>{eventMeta.label}</Text>
                      {event.notes ? <Text style={styles.timelineNote}>{event.notes}</Text> : null}
                      <Text style={styles.timelineTime}>{formatDateTime(event.created_at)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {isCancellable(order.status) ? (
          <Button
            label="Batalkan Pesanan"
            variant="danger"
            icon="close-circle-outline"
            loading={cancelling}
            onPress={confirmCancel}
            style={styles.cancel}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  statusCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    ...CardShadow,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chipText: { fontSize: 10.5, fontWeight: '700' },
  statusTime: { fontSize: 11, color: Brand.textMuted },
  statusTitle: { fontSize: 17, fontWeight: '700', color: Brand.text, marginTop: Space.md },
  statusSub: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 4, marginTop: Space.md },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Brand.divider },
  segmentActive: { backgroundColor: Brand.primary },
  mechanicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginTop: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  mechanicCopy: { flex: 1 },
  mechanicName: { fontSize: 14, fontWeight: '700', color: Brand.text },
  mechanicRole: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  chatButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.whatsapp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingCard: {
    flexDirection: 'row',
    gap: Space.sm,
    alignItems: 'center',
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginTop: Space.md,
  },
  searchingText: { flex: 1, fontSize: 11.5, color: Brand.amber, lineHeight: 16 },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.xxl,
    marginBottom: Space.md,
  },
  detailCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  detailRow: {
    paddingVertical: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
  },
  detailLabel: { fontSize: 11, color: Brand.textMuted, fontWeight: '600' },
  detailValue: { fontSize: 13, color: Brand.text, marginTop: 3, lineHeight: 18 },
  detailValueHighlight: { fontSize: 15, fontWeight: '700', color: Brand.primary },
  timelineRow: { flexDirection: 'row', gap: Space.md, paddingVertical: Space.sm },
  timelineLeft: { alignItems: 'center', width: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, backgroundColor: Brand.divider, marginTop: 2 },
  timelineCopy: { flex: 1, paddingBottom: Space.sm },
  timelineTitle: { fontSize: 13, fontWeight: '600', color: Brand.text },
  timelineNote: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  timelineTime: { fontSize: 10.5, color: Brand.textMuted, marginTop: 3 },
  cancel: { marginTop: Space.xxl },
  paymentCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.lg,
  },
  paymentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  paymentLabel: { fontSize: 11.5, color: Brand.textMuted, fontWeight: '600' },
  paymentAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: Brand.text,
    marginTop: 2,
    letterSpacing: -0.4,
  },
  paymentBadge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  paymentBadgePaid: { backgroundColor: Brand.greenSoft },
  paymentBadgePending: { backgroundColor: Brand.amberSoft },
  paymentBadgeText: { fontSize: 10.5, fontWeight: '700' },
  paymentBadgeTextPaid: { color: Brand.green },
  paymentBadgeTextPending: { color: Brand.amber },
  paymentHint: {
    fontSize: 11.5,
    color: Brand.textSecondary,
    lineHeight: 17,
    marginTop: Space.md,
  },
  paymentMeta: { fontSize: 10.5, color: Brand.textMuted, marginTop: 6 },
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.md,
  },
  paymentStatusText: {
    flex: 1,
    fontSize: 12,
    color: Brand.green,
    fontWeight: '600',
    lineHeight: 17,
  },
  payButton: { marginTop: Space.lg },
  pressed: { opacity: 0.7 },
});
