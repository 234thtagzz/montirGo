import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import {
  Brand,
  Radius,
  ScreenPadding,
  Space,
  Tabular,
  Type,
} from '@/constants/brand';
import { createRealtimeChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import {
  cancelServiceRequest,
  getRequest,
  getReviewForRequest,
  listStatusHistory,
  submitReview,
  type AssignmentDecision,
  type ClientOrder,
  type ClientReview,
  type OrderStatusEvent,
} from '@/features/client/service';
import {
  analyzeRequest,
  getRequestAnalysis,
  type AiAnalysis,
} from '@/features/service-request/ai';
import {
  choosePaymentMethod,
  createPaymentSession,
  getPaymentForRequest,
  syncPaymentStatus,
  type OrderPayment,
} from '@/features/finance/service';
import { AiAnalysisCard } from '@/features/service-request/components/ai-analysis-card';
import { ClientTripEntryCard } from '@/features/client/components/tracking/client-trip-entry-card';
import { AssignmentConfirmationSheet } from '@/features/client/components/assignment/assignment-confirmation-sheet';
import { expireStaleAssignments } from '@/features/service-request/assignments';
import { VehicleProfileCard } from '@/features/vehicles/components/vehicle-profile-card';
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
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cashVisible, setCashVisible] = useState(false);
  const [payment, setPayment] = useState<OrderPayment | null>(null);
  const [paying, setPaying] = useState(false);
  const [choosingCash, setChoosingCash] = useState(false);
  const [review, setReview] = useState<ClientReview | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [assignmentVisible, setAssignmentVisible] = useState(false);
  const assignmentAutoOpened = useRef<string | null>(null);

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
      const [detail, events, existingReview] = await Promise.all([
        getRequest(id),
        listStatusHistory(id),
        getReviewForRequest(id).catch(() => null),
      ]);
      setOrder(detail);
      setHistory(events);
      setReview(existingReview);
      if (existingReview) {
        setReviewRating(existingReview.rating);
        setReviewComment(existingReview.comment ?? '');
      }
      // Pengajuan montir wajib dikonfirmasi: buka lembar konfirmasi otomatis
      // sekali setiap kali order masuk status mechanic_assigned.
      if (detail?.status === 'mechanic_assigned' && detail.mechanic_id) {
        if (assignmentAutoOpened.current !== detail.id) {
          assignmentAutoOpened.current = detail.id;
          setAssignmentVisible(true);
        }
      } else {
        assignmentAutoOpened.current = null;
        setAssignmentVisible(false);
      }
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
    const channel = createRealtimeChannel(`client-order-${id}`)
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

  const handleAssignmentResolved = useCallback(
    async (decision: AssignmentDecision) => {
      setAssignmentVisible(false);
      if (decision === 'reject_and_cancel') {
        assignmentAutoOpened.current = null;
        await load();
        Alert.alert(
          'Pesanan dibatalkan',
          'Pesanan sudah dibatalkan. Kamu bisa membuat pesanan baru kapan saja.',
        );
        return;
      }
      // Muat ulang; status terbaru dari server yang menentukan tampilan berikutnya.
      assignmentAutoOpened.current = decision === 'accept' ? order?.id ?? null : null;
      await load();
      if (decision === 'accept') {
        Alert.alert(
          'Montir dikonfirmasi',
          'Montir akan segera menuju lokasimu. Kamu bisa memantau perjalanannya di halaman ini.',
        );
      }
    },
    [load, order?.id],
  );

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

  const doCancel = async () => {
    if (!id) return;
    setCancelling(true);
    try {
      await cancelServiceRequest(id);
      setCancelVisible(false);
      await load();
    } catch (cancelError) {
      Alert.alert(
        'Gagal membatalkan',
        cancelError instanceof Error ? cancelError.message : 'Coba lagi.',
      );
    } finally {
      setCancelling(false);
    }
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
      // Pastikan order tidak lagi ditandai "tunai" bila client beralih ke
      // pembayaran online.
      await choosePaymentMethod(id, 'online').catch(() => null);
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

  /** Client memilih bayar tunai — montir yang akan mengonfirmasi pembayaran. */
  const chooseCash = async () => {
    if (!id || choosingCash || paying) return;
    setChoosingCash(true);
    try {
      await choosePaymentMethod(id, 'cash');
      setCashVisible(false);
      await load();
    } catch (e) {
      Alert.alert(
        'Gagal memilih metode',
        e instanceof Error ? e.message : 'Coba lagi beberapa saat lagi.',
      );
    } finally {
      setChoosingCash(false);
    }
  };

  const sendReview = async () => {
    if (!id || submittingReview) return;
    if (reviewRating < 1) {
      Alert.alert('Pilih rating', 'Ketuk bintang untuk memberi penilaian 1 sampai 5.');
      return;
    }
    setSubmittingReview(true);
    try {
      await submitReview({
        requestId: id,
        rating: reviewRating,
        comment: reviewComment,
      });
      Alert.alert('Terima kasih', 'Ulasanmu tersimpan dan rating montir sudah diperbarui.');
      await load();
    } catch (error) {
      Alert.alert('Gagal mengirim ulasan', error instanceof Error ? error.message : 'Coba lagi.');
    } finally {
      setSubmittingReview(false);
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
  const hasVehicle = Boolean(
    order.vehicle_type ||
      order.vehicle_brand ||
      order.vehicle_model ||
      order.vehicle_plate ||
      order.vehicle_photo_url,
  );
  /** Client sudah memilih tunai dan menunggu montir mengonfirmasi. */
  const cashSelected = order.status === 'payment' && order.payment_method === 'cash';
  const paidWithCash = order.status === 'paid' && payment?.method === 'cash';

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
        <View style={styles.statusHero}>
          <View style={styles.statusTop}>
            <View style={styles.statusChip}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      order.status === 'cancelled'
                        ? Brand.red
                        : order.status === 'paid'
                          ? Brand.green
                          : meta.step > 0
                            ? Brand.volt
                            : Brand.amber,
                  },
                ]}
              />
              <Text style={styles.statusChipText}>{meta.shortLabel}</Text>
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

          <View style={styles.statusFooter}>
            <Text style={styles.statusId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
            {order.price_amount != null ? (
              <Text style={[styles.statusAmount, Tabular]}>
                {formatIDR(order.price_amount)}
              </Text>
            ) : null}
          </View>
        </View>

        {order.status === 'on_the_way' ? (
          <ClientTripEntryCard
            onPress={() =>
              router.push({
                pathname: '/(client)/tracking/[id]',
                params: { id: order.id },
              })
            }
          />
        ) : null}

        {order.status === 'mechanic_assigned' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lihat dan konfirmasi montir"
            onPress={() => setAssignmentVisible(true)}
            style={({ pressed }) => [styles.assignmentCard, pressed && styles.pressed]}
          >
            <View style={styles.assignmentIcon}>
              <Ionicons name="person-add-outline" size={19} color={Brand.amber} />
            </View>
            <View style={styles.assignmentCopy}>
              <Text style={styles.assignmentKicker}>PERLU KEPUTUSANMU</Text>
              <Text style={styles.assignmentTitle}>Konfirmasi montir</Text>
              <Text style={styles.assignmentText} numberOfLines={2}>
                {order.mechanic_name ?? 'Seorang montir'} ingin menangani pesananmu. Lihat rating
                dan bengkelnya sebelum menyetujui.
              </Text>
            </View>
            <View style={styles.assignmentAction}>
              <Text style={styles.assignmentActionText}>Lihat</Text>
              <Ionicons name="chevron-forward" size={13} color={Brand.amber} />
            </View>
          </Pressable>
        ) : order.mechanic_id ? (
          <View style={styles.mechanicCard}>
            <Avatar name={order.mechanic_name ?? 'Montir'} uri={order.mechanic_avatar} size={44} />
            <View style={styles.mechanicCopy}>
              <Text style={styles.mechanicKicker}>MONTIRMU</Text>
              <Text style={styles.mechanicName} numberOfLines={1}>
                {order.mechanic_name ?? 'Montir MontirGo'}
              </Text>
              <Text style={styles.mechanicRole} numberOfLines={1}>
                Menangani pesanan ini
              </Text>
            </View>
            {order.mechanic_phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hubungi montir lewat WhatsApp"
                onPress={chatMechanic}
                style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
              >
                <Ionicons name="logo-whatsapp" size={18} color={Brand.volt} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.searchingCard}>
            <View style={styles.searchingIcon}>
              <Ionicons name="search-outline" size={17} color={Brand.amber} />
            </View>
            <View style={styles.searchingCopy}>
              <Text style={styles.searchingTitle}>Mencari montir terdekat</Text>
              <Text style={styles.searchingText}>
                Kamu akan menerima notifikasi saat montir mengajukan diri.
              </Text>
            </View>
          </View>
        )}

        {order.status === 'payment' || order.status === 'paid' ? (
          <>
            <SectionHeader eyebrow="TAGIHAN" title="Pembayaran" />
            <View style={styles.paymentCard}>
              <View style={styles.paymentTop}>
                <View>
                  <Text style={styles.paymentLabel}>Total tagihan</Text>
                  <Text style={[styles.paymentAmount, Tabular]}>
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
                    {order.status === 'paid'
                      ? 'Lunas'
                      : cashSelected
                        ? 'Tunai'
                        : 'Belum dibayar'}
                  </Text>
                </View>
              </View>

              {order.status === 'paid' ? (
                <View style={styles.paymentStatusRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Brand.green} />
                  <Text style={styles.paymentStatusText}>
                    {paidWithCash ? 'Pembayaran tunai dikonfirmasi montir' : 'Pembayaran diterima'}
                    {payment?.paid_at ? ` · ${formatDateTime(payment.paid_at)}` : ''}.
                  </Text>
                </View>
              ) : cashSelected ? (
                <>
                  <View style={styles.cashCard}>
                    <View style={styles.cashHeader}>
                      <Ionicons name="cash-outline" size={18} color={Brand.amber} />
                      <Text style={styles.cashTitle}>Bayar tunai ke montir</Text>
                    </View>
                    <Text style={styles.cashText}>
                      Siapkan uang tunai{' '}
                      <Text style={[styles.cashAmount, Tabular]}>
                        {formatIDR(order.price_amount ?? payment?.amount ?? 0)}
                      </Text>{' '}
                      dan bayar langsung ke {order.mechanic_name ?? 'montir'}. Pembayaran dicatat
                      setelah montir menekan konfirmasi.
                    </Text>
                    <View style={styles.cashStatus}>
                      <Ionicons name="time-outline" size={13} color={Brand.amber} />
                      <Text style={styles.cashStatusText}>Menunggu konfirmasi montir</Text>
                    </View>
                  </View>
                  <Button
                    label="Ganti ke Pembayaran Online"
                    icon="card-outline"
                    variant="secondary"
                    loading={paying}
                    onPress={payOrder}
                    style={styles.payButton}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.paymentHint}>
                    Bayar dengan QRIS, GoPay, OVO, DANA, atau ShopeePay di halaman aman Xendit.
                    Status pesanan diperbarui otomatis setelah pembayaran berhasil.
                  </Text>
                  {payment?.expires_at ? (
                    <View style={styles.paymentMetaRow}>
                      <Ionicons name="time-outline" size={12} color={Brand.textMuted} />
                      <Text style={styles.paymentMeta}>
                        Link pembayaran berlaku sampai {formatDateTime(payment.expires_at)}
                      </Text>
                    </View>
                  ) : null}
                  <Button
                    label="Bayar Sekarang"
                    icon="card-outline"
                    loading={paying}
                    onPress={payOrder}
                    style={styles.payButton}
                  />
                  <Button
                    label="Bayar Tunai ke Montir"
                    icon="cash-outline"
                    variant="secondary"
                    loading={choosingCash}
                    disabled={paying}
                    onPress={() => setCashVisible(true)}
                    style={styles.cashButton}
                  />
                </>
              )}
            </View>
          </>
        ) : null}

        {order.status === 'paid' ? (
          <>
            <SectionHeader eyebrow="PENGALAMANMU" title="Ulasan montir" />
            {review ? (
              <View style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.starsRow}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Ionicons
                        key={index}
                        name={index < review.rating ? 'star' : 'star-outline'}
                        size={18}
                        color={Brand.amber}
                      />
                    ))}
                  </View>
                  <Text style={styles.reviewDate}>{formatDateTime(review.created_at)}</Text>
                </View>
                {review.comment ? (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                ) : (
                  <Text style={styles.reviewMuted}>Kamu tidak menulis komentar.</Text>
                )}
                {review.mechanic_reply ? (
                  <View style={styles.reviewReply}>
                    <Text style={styles.reviewReplyLabel}>Balasan montir</Text>
                    <Text style={styles.reviewReplyText}>{review.mechanic_reply}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.reviewCard}>
                <Text style={styles.reviewTitle}>Bagaimana pelayanan montir?</Text>
                <Text style={styles.reviewHint}>
                  Rating dan ulasanmu tersimpan di database serta membantu client lain memilih
                  montir.
                </Text>
                <View style={styles.ratingPicker}>
                  {Array.from({ length: 5 }).map((_, index) => {
                    const value = index + 1;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={`Beri ${value} bintang`}
                        hitSlop={6}
                        onPress={() => setReviewRating(value)}
                      >
                        <Ionicons
                          name={value <= reviewRating ? 'star' : 'star-outline'}
                          size={30}
                          color={Brand.amber}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Tulis pengalamanmu (opsional)"
                  placeholderTextColor={Brand.textMuted}
                  selectionColor={Brand.primary}
                  multiline
                  style={styles.reviewInput}
                />
                <Button
                  label="Kirim Ulasan"
                  icon="send-outline"
                  loading={submittingReview}
                  onPress={sendReview}
                  style={styles.reviewButton}
                />
              </View>
            )}
          </>
        ) : null}

        {hasVehicle ? (
          <>
            <SectionHeader eyebrow="GARASI" title="Kendaraan" />
            <VehicleProfileCard
              variant="compact"
              photo={order.vehicle_photo_url}
              type={order.vehicle_type}
              brand={order.vehicle_brand}
              model={order.vehicle_model}
              year={order.vehicle_year}
              plate={order.vehicle_plate}
            />
          </>
        ) : null}

        <SectionHeader eyebrow="RINCIAN" title="Detail permintaan" />
        <View style={styles.detailCard}>
          <DetailRow label="Keluhan" value={order.issue_description} />
          {order.symptoms ? <DetailRow label="Gejala" value={order.symptoms} /> : null}
          {!hasVehicle ? <DetailRow label="Kendaraan" value="Tidak dicantumkan" /> : null}
          <DetailRow label="Lokasi" value={order.address || 'Lokasi GPS terdeteksi'} />
          <DetailRow label="WhatsApp" value={order.contact_phone} />
          {order.additional_notes ? (
            <DetailRow label="Catatan" value={order.additional_notes} />
          ) : null}
          {order.price_amount != null ? (
            <DetailRow label="Biaya" value={formatIDR(order.price_amount)} highlight />
          ) : null}
        </View>

        <SectionHeader eyebrow="DIAGNOSA" title="Analisis AI" />
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
            <SectionHeader eyebrow="PERJALANAN" title="Riwayat status" />
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
            onPress={() => setCancelVisible(true)}
            style={styles.cancel}
          />
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={cancelVisible}
        destructive
        loading={cancelling}
        icon="close-circle-outline"
        title="Batalkan pesanan?"
        message="Montir tidak akan datang jika pesanan dibatalkan. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Ya, batalkan"
        cancelLabel="Tidak"
        onConfirm={doCancel}
        onCancel={() => (cancelling ? undefined : setCancelVisible(false))}
      />

      <ConfirmSheet
        visible={cashVisible}
        loading={choosingCash}
        icon="cash-outline"
        title="Bayar tunai ke montir?"
        message={`Siapkan uang tunai ${formatIDR(
          order.price_amount ?? payment?.amount ?? 0,
        )} dan bayar langsung ke ${
          order.mechanic_name ?? 'montir'
        }. Pembayaran dicatat setelah montir mengonfirmasi.`}
        confirmLabel="Ya, bayar tunai"
        onConfirm={chooseCash}
        onCancel={() => (choosingCash ? undefined : setCashVisible(false))}
      />

      <AssignmentConfirmationSheet
        visible={assignmentVisible && order.status === 'mechanic_assigned'}
        order={order}
        onResolved={handleAssignmentResolved}
        onRefresh={() => {
          void expireStaleAssignments().then(() => load());
        }}
      />
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
  statusHero: {
    backgroundColor: Brand.ink,
    borderRadius: Radius.lg,
    padding: Space.lg,
    overflow: 'hidden',
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: {
    ...Type.micro,
    color: Brand.inkText,
    letterSpacing: 0.7,
  },
  statusTime: { fontSize: 10.5, color: Brand.inkMuted },
  statusTitle: { ...Type.h2, fontSize: 19, color: Brand.white, marginTop: Space.md },
  statusSub: { fontSize: 12, color: Brand.inkText, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 4, marginTop: Space.lg },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  segmentActive: { backgroundColor: Brand.volt },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.lg,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  statusId: { fontSize: 10.5, color: Brand.inkMuted, letterSpacing: 0.8 },
  statusAmount: { fontSize: 15, fontWeight: '800', color: Brand.white, letterSpacing: -0.2 },
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
  mechanicKicker: { ...Type.micro, fontSize: 9, color: Brand.textMuted, marginBottom: 2 },
  mechanicName: { ...Type.bodyStrong, fontWeight: '700', color: Brand.text },
  mechanicRole: { fontSize: 11, color: Brand.textSecondary, marginTop: 1 },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Brand.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingCard: {
    flexDirection: 'row',
    gap: Space.md,
    alignItems: 'center',
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginTop: Space.md,
  },
  searchingIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingCopy: { flex: 1 },
  searchingTitle: { fontSize: 12.5, fontWeight: '700', color: Brand.amber },
  searchingText: { fontSize: 11, color: Brand.textSecondary, marginTop: 2, lineHeight: 15 },
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginTop: Space.md,
    borderWidth: 1,
    borderColor: Brand.amber,
  },
  assignmentIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Brand.amberSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignmentCopy: { flex: 1 },
  assignmentKicker: { ...Type.micro, fontSize: 8.5, color: Brand.amber },
  assignmentTitle: { fontSize: 13.5, fontWeight: '800', color: Brand.text, marginTop: 2 },
  assignmentText: { fontSize: 11, color: Brand.textSecondary, lineHeight: 15, marginTop: 2 },
  assignmentAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  assignmentActionText: { fontSize: 11.5, fontWeight: '800', color: Brand.amber },
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
    ...Type.display,
    fontSize: 26,
    lineHeight: 32,
    color: Brand.text,
    marginTop: 2,
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
  paymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  paymentMeta: { fontSize: 10.5, color: Brand.textMuted },
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
  cashButton: { marginTop: Space.sm },
  cashCard: {
    marginTop: Space.md,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  cashHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  cashTitle: { fontSize: 12.5, fontWeight: '700', color: Brand.amber },
  cashText: {
    fontSize: 11.5,
    color: Brand.textSecondary,
    lineHeight: 17,
    marginTop: Space.sm,
  },
  cashAmount: { fontSize: 12, fontWeight: '800', color: Brand.amber },
  cashStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Space.md,
  },
  cashStatusText: { fontSize: 11, fontWeight: '600', color: Brand.amber },
  reviewCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.lg,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewDate: { fontSize: 10.5, color: Brand.textMuted },
  reviewTitle: { fontSize: 13.5, fontWeight: '700', color: Brand.text },
  reviewHint: {
    fontSize: 11.5,
    color: Brand.textSecondary,
    lineHeight: 17,
    marginTop: 4,
  },
  reviewComment: {
    fontSize: 12.5,
    color: Brand.text,
    lineHeight: 18,
    marginTop: Space.md,
  },
  reviewMuted: { fontSize: 11.5, color: Brand.textMuted, marginTop: Space.md },
  reviewReply: {
    marginTop: Space.md,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.sm,
    padding: Space.sm,
  },
  reviewReplyLabel: { fontSize: 10, fontWeight: '700', color: Brand.primary },
  reviewReplyText: { fontSize: 11.5, color: Brand.text, marginTop: 2, lineHeight: 17 },
  ratingPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space.sm,
    marginTop: Space.lg,
  },
  reviewInput: {
    marginTop: Space.md,
    backgroundColor: Brand.background,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingTop: Space.md,
    minHeight: 80,
    fontSize: 13,
    color: Brand.text,
    textAlignVertical: 'top',
  },
  reviewButton: { marginTop: Space.md },
  pressed: { opacity: 0.7 },
});
