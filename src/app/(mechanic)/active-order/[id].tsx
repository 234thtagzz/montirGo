import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { Money } from "@/components/ui/money";
import { SectionHeader } from "@/components/ui/section-header";
import { Ionicons } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import {
  Brand,
  CardShadow,
  Radius,
  ScreenPadding,
  Space,
  Tabular,
  Type,
} from "@/constants/brand";
import {
  getMechanicProgressLabel,
  getNextAction,
} from "@/features/mechanic/constants";
import {
  getMyOrder,
  listOrderStatusHistory,
  setOrderPrice,
  updateOrderStatus,
  type MechanicOrderDetail,
  type OrderStatusEvent,
} from "@/features/mechanic/service";
import {
  confirmCashPayment,
  getFinanceSettings,
  syncPaymentStatus,
  type FinanceSettings,
} from "@/features/finance/service";
import {
  analyzeRequest,
  getRequestAnalysis,
  type AiAnalysis,
} from "@/features/service-request/ai";
import { AiAnalysisCard } from "@/features/service-request/components/ai-analysis-card";
import { getStatusMeta, TOTAL_STEPS } from "@/features/service-request/status";
import { TripEntryCard } from "@/features/mechanic/components/trip/trip-entry-card";
import { AssignmentPendingCard } from "@/features/mechanic/components/assignment-pending-card";
import { VehicleProfileCard } from "@/features/vehicles/components/vehicle-profile-card";
import { createRealtimeChannel } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { formatDateTime, formatIDR } from "@/utils/format";
import { openWhatsApp } from "@/utils/whatsapp";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from "react-native";

export default function MechanicOrderDetailScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const billingOffset = useRef<number | null>(null);
  const scrolledToBilling = useRef(false);

  const [order, setOrder] = useState<MechanicOrderDetail | null>(null);
  const [history, setHistory] = useState<OrderStatusEvent[]>([]);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const [sendingPrice, setSendingPrice] = useState(false);
  const [confirmingCash, setConfirmingCash] = useState(false);
  const [priceConfirmOpen, setPriceConfirmOpen] = useState(false);
  const [cashConfirmOpen, setCashConfirmOpen] = useState(false);

  const loadAnalysis = useCallback(async () => {
    if (!id) return;
    try {
      setAnalysis(await getRequestAnalysis(id));
      setAnalysisError(null);
    } catch {
      setAnalysisError(
        "Analisis AI gagal dimuat. Periksa koneksi lalu coba lagi.",
      );
    }
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, events] = await Promise.all([
        getMyOrder(id),
        listOrderStatusHistory(id),
      ]);
      setOrder(detail);
      setHistory(events);
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

  // Realtime: perubahan status order + hasil analisis AI.
  useEffect(() => {
    if (!id) return;
    const channel = createRealtimeChannel(`mechanic-order-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          filter: `id=eq.${id}`,
        },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ai_diagnoses",
          filter: `request_id=eq.${id}`,
        },
        () => loadAnalysis(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load, loadAnalysis]);

  // Webhook Xendit bisa telat atau belum terdaftar. Selama status order masih
  // `payment`, montir juga memeriksa langsung ke Xendit agar status "lunas"
  // ikut berubah walau notifikasi webhook tidak sampai ke server.
  useEffect(() => {
    if (!id || order?.status !== "payment") return;
    let active = true;

    const tick = async () => {
      try {
        const result = await syncPaymentStatus(id);
        if (!active || result.status !== "paid") return;
        const [detail, events] = await Promise.all([
          getMyOrder(id),
          listOrderStatusHistory(id),
        ]);
        if (!active) return;
        setOrder(detail);
        setHistory(events);
      } catch {
        // Gagal sementara — interval berikutnya mencoba lagi.
      }
    };

    void tick();
    const timer = setInterval(tick, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, order?.status]);

  useEffect(() => {
    let cancelled = false;
    getFinanceSettings()
      .then((value) => {
        if (!cancelled) setSettings(value);
      })
      .catch(() => {
        // Batas harga memakai default UI bila pengaturan gagal dimuat.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Montir yang baru menekan "Sampai di Lokasi" diarahkan ke sini dengan
  // param `focus=invoice`, jadi form tagihan langsung terlihat tanpa scroll manual.
  const handleBillingLayout = useCallback(
    (event: LayoutChangeEvent) => {
      billingOffset.current = event.nativeEvent.layout.y;
      if (focus !== "invoice" || scrolledToBilling.current) return;
      scrolledToBilling.current = true;
      const y = Math.max(0, billingOffset.current - Space.md);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y, animated: true });
      });
    },
    [focus],
  );

  const existingPrice = order?.price_amount ?? null;
  // Selama mekanik mengetik, pakai draft lokal. Bila belum mengetik, input
  // mengikuti harga terakhir dari server tanpa perlu efek sinkronisasi.
  const priceText = priceDraft ?? (existingPrice != null ? String(existingPrice) : "");

  const priceValue = Number(priceText.replace(/[^0-9]/g, "")) || 0;
  const minPrice = settings?.minOrderPrice ?? 10000;
  const maxPrice = settings?.maxOrderPrice ?? 10000000;
  const feePercent = settings?.feePercent ?? 10;
  const platformFee = Math.round((priceValue * feePercent) / 100);
  const netPrice = priceValue - platformFee;
  const priceError =
    priceValue === 0
      ? null
      : priceValue < minPrice
        ? `Minimal ${formatIDR(minPrice)}.`
        : priceValue > maxPrice
          ? `Maksimal ${formatIDR(maxPrice)}.`
          : null;
  const canSendPrice =
    !sendingPrice &&
    priceValue >= minPrice &&
    priceValue <= maxPrice &&
    !priceError;
  const canEditPrice =
    order != null &&
    ["arrived", "diagnosing", "repairing", "completed"].includes(order.status);

  const openPriceConfirm = () => {
    if (!order || !canSendPrice) return;
    setPriceConfirmOpen(true);
  };

  const sendPrice = async () => {
    if (!order || !canSendPrice) return;
    setSendingPrice(true);
    try {
      await setOrderPrice(order.id, priceValue);
      setPriceConfirmOpen(false);
      setPriceDraft(null);
      await load();
    } catch (e) {
      Alert.alert(
        "Gagal mengirim tagihan",
        e instanceof Error ? e.message : "Coba lagi.",
      );
    } finally {
      setSendingPrice(false);
    }
  };

  /** Montir mengonfirmasi uang tunai sudah diterima dari client. */
  const openCashConfirm = () => {
    if (!order || confirmingCash) return;
    setCashConfirmOpen(true);
  };

  const submitCash = async () => {
    if (!order) return;
    setConfirmingCash(true);
    try {
      await confirmCashPayment(order.id);
      setCashConfirmOpen(false);
      await load();
    } catch (e) {
      Alert.alert(
        'Gagal mengonfirmasi',
        e instanceof Error ? e.message : 'Coba lagi.',
      );
    } finally {
      setConfirmingCash(false);
    }
  };

  const retryAnalysis = async () => {
    if (!id || analyzing) return;
    setAnalyzing(true);
    try {
      await analyzeRequest(id);
      await loadAnalysis();
    } catch (e) {
      setAnalysisError(
        e instanceof Error
          ? e.message
          : "Analisis AI gagal. Coba lagi beberapa saat lagi.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const chatClient = () => {
    if (!order) return;
    const phone = order.client_phone ?? order.contact_phone;
    void openWhatsApp(
      phone,
      `Halo, saya montir MontirGo yang menangani pesanan #${order.id
        .slice(0, 8)
        .toUpperCase()}.`,
    );
  };

  const nextAction = order ? getNextAction(order.status) : null;
  const pendingConfirmation = order?.status === "mechanic_assigned";
  const tripStatus: "mechanic_accepted" | "on_the_way" | null =
    order?.status === "mechanic_accepted" || order?.status === "on_the_way"
      ? order.status
      : null;
  // Transisi "Mulai Perjalanan"/"Sampai di Lokasi" dimiliki layar trip agar
  // tidak ada dua tombol yang mengubah status yang sama.
  const stageAction = tripStatus ? null : nextAction;

  const advance = () => {
    if (!order || !nextAction) return;
    Alert.alert(
      "Ubah status order?",
      `Status akan menjadi "${nextAction.label}".`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "lanjutkan",
          onPress: async () => {
            setUpdating(true);
            try {
              await updateOrderStatus(order.id, nextAction.next);
              await load();
            } catch (e) {
              Alert.alert(
                "Gagal",
                e instanceof Error ? e.message : "Tidak bisa mengubah status.",
              );
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Order" />
        <LoadingState message="Memuat order..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Order" />
        <ErrorState onRetry={load} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Order" />
        <EmptyState
          icon="construct-outline"
          message="Order tidak ditemukan"
          hint="Order mungkin sudah selesai atau bukan milikmu."
          actionLabel="Kembali ke Beranda"
          onPressAction={() => router.replace("/(mechanic)/(tabs)")}
        />
      </View>
    );
  }

  const meta = getStatusMeta(order.status);
  const cashAmount = order.price_amount ?? 0;
  const hasVehicle = Boolean(
    order.vehicle_type ||
      order.vehicle_brand ||
      order.vehicle_model ||
      order.vehicle_plate ||
      order.vehicle_photo_url,
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Detail Order"
        subtitle={`#${order.id.slice(0, 8).toUpperCase()}`}
      />
      <ScrollView
        ref={scrollRef}
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
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroChip}>
              <View style={[styles.heroChipDot, { backgroundColor: meta.color }]} />
              <Text style={styles.heroChipText}>{meta.shortLabel}</Text>
            </View>
            <Text style={styles.heroTime}>{formatDateTime(order.created_at)}</Text>
          </View>
          <Text style={styles.heroTitle}>
            {getMechanicProgressLabel(order.status)}
          </Text>
          <Text style={styles.heroSub}>{meta.label}</Text>

          {meta.step > 0 ? (
            <View style={styles.progressWrap}>
              <View style={styles.progress}>
                {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.segment,
                      index < meta.step && styles.segmentActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.progressLabel}>
                Tahap {meta.step} dari {TOTAL_STEPS}
              </Text>
            </View>
          ) : null}

          <View style={styles.heroDivider} />

          <View style={styles.clientRow}>
            <Avatar name={order.client_name ?? "Client"} size={42} />
            <View style={styles.clientCopy}>
              <Text style={styles.clientName} numberOfLines={1}>
                {order.client_name ?? "Client MontirGo"}
              </Text>
              <Text style={styles.clientRole}>Pelanggan yang kamu tangani</Text>
            </View>
            {order.client_phone || order.contact_phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hubungi pelanggan lewat WhatsApp"
                onPress={chatClient}
                style={({ pressed }) => [
                  styles.chatButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="logo-whatsapp" size={19} color={Brand.volt} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {pendingConfirmation ? (
          <AssignmentPendingCard expiresAt={order.assignment_expires_at} />
        ) : tripStatus ? (
          <TripEntryCard
            status={tripStatus}
            onPress={() =>
              router.push({
                pathname: '/(mechanic)/trip/[id]',
                params: { id: order.id },
              })
            }
          />
        ) : null}

        {hasVehicle ? (
          <>
            <SectionHeader eyebrow="KENDARAAN" title="Kendaraan client" />
            <VehicleProfileCard
              title="Data kendaraan"
              photo={order.vehicle_photo_url}
              type={order.vehicle_type}
              brand={order.vehicle_brand}
              model={order.vehicle_model}
              year={order.vehicle_year}
              plate={order.vehicle_plate}
            />
          </>
        ) : null}

        <SectionHeader eyebrow="KELUHAN" title="Detail permintaan" />
        <View style={styles.detailCard}>
          <DetailRow label="Keluhan" value={order.issue_description} />
          {order.symptoms ? (
            <DetailRow label="Gejala" value={order.symptoms} />
          ) : null}
          {!hasVehicle ? (
            <DetailRow label="Kendaraan" value="Tidak dicantumkan" />
          ) : null}
          <DetailRow
            label="Lokasi"
            value={order.address || "Lokasi GPS terdeteksi"}
          />
          <DetailRow label="WhatsApp" value={order.contact_phone} />
          {order.additional_notes ? (
            <DetailRow label="Catatan" value={order.additional_notes} />
          ) : null}
          {order.price_amount != null ? (
            <DetailRow
              label="Biaya"
              value={formatIDR(order.price_amount)}
              highlight
            />
          ) : null}
        </View>

        <View onLayout={handleBillingLayout} />
        <SectionHeader eyebrow="PEMBAYARAN" title="Tagihan & pembayaran" />
        {canEditPrice ? (
          <View style={styles.billingCard}>
            <Text style={styles.billingLabel}>Nominal tagihan ke client</Text>
            <View style={styles.priceInputRow}>
              <Text style={styles.priceCurrency}>Rp</Text>
              <TextInput
                value={priceValue ? priceValue.toLocaleString("id-ID") : ""}
                onChangeText={(text) =>
                  setPriceDraft(text.replace(/[^0-9]/g, ""))
                }
                placeholder="0"
                placeholderTextColor={Brand.textMuted}
                keyboardType="number-pad"
                selectionColor={Brand.primary}
                style={[styles.priceInput, Tabular]}
              />
            </View>
            {priceError ? (
              <Text style={styles.priceError}>{priceError}</Text>
            ) : (
              <Text style={styles.priceHelper}>
                Rentang {formatIDR(minPrice)} – {formatIDR(maxPrice)}
              </Text>
            )}
            <View style={styles.priceRow}>
              <Text style={styles.priceMetaLabel}>
                Fee platform ({feePercent}%)
              </Text>
              <Text style={[styles.priceMetaValue, Tabular]}>
                − {formatIDR(platformFee)}
              </Text>
            </View>
            <View style={styles.netBand}>
              <View style={styles.netCopy}>
                <Text style={styles.netLabel}>Kamu terima</Text>
                <Text style={styles.netHint}>Setelah fee platform</Text>
              </View>
              <Money value={netPrice} size="md" color={Brand.green} />
            </View>
            <Button
              label="Kirim Tagihan ke Client"
              icon="receipt-outline"
              variant="ink"
              loading={sendingPrice}
              disabled={!canSendPrice}
              onPress={openPriceConfirm}
              style={styles.sendPrice}
            />
            <Text style={styles.billingHint}>
              Client bisa membayar online lewat QRIS / e-wallet Xendit atau tunai
              langsung. Pembayaran tunai dicatat setelah kamu mengonfirmasi uang
              diterima, dan tidak masuk saldo dompet.
            </Text>
          </View>
        ) : order.status === "payment" ? (
          <>
            <View style={styles.pendingCard}>
              <Ionicons
                name={order.payment_method === "cash" ? "cash-outline" : "time-outline"}
                size={18}
                color={Brand.amber}
              />
              <View style={styles.pendingCopy}>
                <Text style={styles.pendingText}>
                  Tagihan {formatIDR(order.price_amount ?? 0)} sudah dikirim.{" "}
                  {order.payment_method === "cash"
                    ? "Client memilih bayar tunai — konfirmasi setelah uang kamu terima."
                    : "Menunggu pembayaran client."}
                </Text>
                {order.payment_method === "cash" ? (
                  <Text style={styles.pendingHint}>
                    Uang tunai tidak masuk saldo dompet, tetapi tercatat di menu
                    Pendapatan.
                  </Text>
                ) : null}
              </View>
            </View>
            {order.payment_method === "cash" ? (
              <Button
                label="Konfirmasi Pembayaran Cash"
                icon="cash-outline"
                variant="ink"
                loading={confirmingCash}
                onPress={openCashConfirm}
                style={styles.cashConfirm}
              />
            ) : (
              <Button
                label="Konfirmasi Pembayaran Tunai"
                icon="cash-outline"
                variant="secondary"
                loading={confirmingCash}
                onPress={openCashConfirm}
                style={styles.cashConfirm}
              />
            )}
          </>
        ) : order.status === "paid" ? (
          <View style={styles.doneCard}>
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color={Brand.green}
            />
            <Text style={styles.doneText}>
              {order.payment_method === "cash" ? (
                <>
                  Pembayaran tunai Rp
                  {(order.price_amount ?? 0).toLocaleString("id-ID")} sudah
                  dikonfirmasi. Pendapatan tunai tercatat di menu Pendapatan dan
                  tidak masuk saldo dompet.
                </>
              ) : (
                <>
                  Pembayaran Rp
                  {(order.price_amount ?? 0).toLocaleString("id-ID")} sudah lunas.
                  Pendapatan masuk ke saldo pending.
                </>
              )}
            </Text>
          </View>
        ) : (
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={Brand.primary}
            />
            <Text style={styles.infoText}>
              Tagihan bisa dikirim setelah kamu menekan “Sampai di Lokasi”. Client
              langsung menerima notifikasi pembayaran.
            </Text>
          </View>
        )}

        <SectionHeader eyebrow="AI" title="Analisis awal" />
        <AiAnalysisCard
          analysis={analysis}
          error={analysisError}
          retrying={analyzing}
          onRetry={
            order.status !== "cancelled" && order.status !== "paid"
              ? retryAnalysis
              : undefined
          }
          subtitle="Indikasi awal — lakukan pemeriksaan langsung"
        />

        {history.length > 0 ? (
          <>
            <SectionHeader eyebrow="RIWAYAT" title="Riwayat status" />
            <View style={styles.detailCard}>
              {history.map((event, index) => {
                const eventMeta = getStatusMeta(event.to_status);
                return (
                  <View key={event.id} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: eventMeta.color },
                        ]}
                      />
                      {index < history.length - 1 ? (
                        <View style={styles.timelineLine} />
                      ) : null}
                    </View>
                    <View style={styles.timelineCopy}>
                      <Text style={styles.timelineTitle}>
                        {eventMeta.label}
                      </Text>
                      {event.notes ? (
                        <Text style={styles.timelineNote}>{event.notes}</Text>
                      ) : null}
                      <Text style={styles.timelineTime}>
                        {formatDateTime(event.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {stageAction ? (
          <Button
            label={stageAction.label}
            icon={stageAction.icon}
            variant="ink"
            loading={updating}
            onPress={advance}
            style={styles.action}
          />
        ) : canEditPrice || tripStatus || pendingConfirmation ? null : (
          <View style={styles.doneCard}>
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color={Brand.green}
            />
            <Text style={styles.doneText}>
              {order.status === "paid"
                ? "Order selesai dan pembayaran sudah lunas."
                : "Tidak ada aksi lanjutan untuk status ini."}
            </Text>
          </View>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={priceConfirmOpen}
        title="Kirim tagihan?"
        message={`Client akan menerima tagihan ${formatIDR(priceValue)} dan bisa langsung membayar.`}
        confirmLabel="Kirim tagihan"
        icon="receipt-outline"
        loading={sendingPrice}
        onConfirm={sendPrice}
        onCancel={() => setPriceConfirmOpen(false)}
      >
        <View style={styles.sheetBox}>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Tagihan</Text>
            <Money value={priceValue} size="sm" color={Brand.text} />
          </View>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Fee platform ({feePercent}%)</Text>
            <Text style={[styles.sheetValue, Tabular]}>
              − {formatIDR(platformFee)}
            </Text>
          </View>
          <View style={styles.sheetDivider} />
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Kamu terima</Text>
            <Money value={netPrice} size="md" color={Brand.green} />
          </View>
        </View>
      </ConfirmSheet>

      <ConfirmSheet
        visible={cashConfirmOpen}
        title="Konfirmasi pembayaran tunai?"
        message={
          `Pastikan kamu sudah menerima uang tunai ${formatIDR(cashAmount)} dari client.` +
          (order.payment_method === "cash"
            ? ""
            : "\n\nClient belum memilih metode tunai di aplikasi.")
        }
        confirmLabel="Ya, sudah diterima"
        icon="cash-outline"
        loading={confirmingCash}
        onConfirm={submitCash}
        onCancel={() => setCashConfirmOpen(false)}
      >
        <View style={styles.sheetCash}>
          <Ionicons name="cash-outline" size={18} color={Brand.green} />
          <Text style={styles.sheetCashText}>
            Pendapatan tunai tercatat di menu Pendapatan, tetapi tidak masuk saldo dompet
            MontirGo.
          </Text>
        </View>
      </ConfirmSheet>
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
      <Text
        style={[styles.detailValue, highlight && styles.detailValueHighlight]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  hero: {
    backgroundColor: Brand.ink,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Brand.inkBorder,
    padding: Space.lg,
    ...CardShadow,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroChipDot: { width: 6, height: 6, borderRadius: 3 },
  heroChipText: { ...Type.micro, color: Brand.inkText, fontSize: 9.5, letterSpacing: 0.3 },
  heroTime: { ...Type.meta, color: Brand.inkMuted, fontSize: 10 },
  heroTitle: { ...Type.h2, color: Brand.white, marginTop: Space.md },
  heroSub: { ...Type.meta, color: Brand.inkMuted, marginTop: 3 },
  progressWrap: { marginTop: Space.lg },
  progress: { flexDirection: "row", gap: 4 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.inkBorder,
  },
  segmentActive: { backgroundColor: Brand.volt },
  progressLabel: { ...Type.micro, color: Brand.inkMuted, fontSize: 9, marginTop: 6 },
  heroDivider: {
    height: 1,
    backgroundColor: Brand.inkBorder,
    marginVertical: Space.lg,
  },
  clientRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
  clientCopy: { flex: 1 },
  clientName: { ...Type.bodyStrong, color: Brand.white, fontWeight: "700" },
  clientRole: { ...Type.meta, color: Brand.inkMuted, marginTop: 2 },
  chatButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  detailCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  detailRow: {
    paddingVertical: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
  },
  detailLabel: { fontSize: 11, color: Brand.textMuted, fontWeight: "600" },
  detailValue: {
    fontSize: 13,
    color: Brand.text,
    marginTop: 3,
    lineHeight: 18,
  },
  detailValueHighlight: {
    fontSize: 15,
    fontWeight: "700",
    color: Brand.primary,
  },
  timelineRow: {
    flexDirection: "row",
    gap: Space.md,
    paddingVertical: Space.sm,
  },
  timelineLeft: { alignItems: "center", width: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Brand.divider,
    marginTop: 2,
  },
  timelineCopy: { flex: 1, paddingBottom: Space.sm },
  timelineTitle: { fontSize: 13, fontWeight: "600", color: Brand.text },
  timelineNote: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  timelineTime: { fontSize: 10.5, color: Brand.textMuted, marginTop: 3 },
  action: { marginTop: Space.xxl },
  billingCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.lg,
    ...CardShadow,
  },
  billingLabel: {
    ...Type.meta,
    fontWeight: "700",
    color: Brand.text,
    marginBottom: Space.sm,
  },
  priceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    backgroundColor: "#F7F9FC",
    paddingHorizontal: Space.md,
  },
  priceCurrency: {
    ...Type.title,
    color: Brand.textSecondary,
  },
  priceInput: {
    flex: 1,
    minHeight: 52,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: Brand.text,
    paddingVertical: 0,
  },
  priceError: { ...Type.meta, color: Brand.red, marginTop: 6 },
  priceHelper: { ...Type.meta, color: Brand.textMuted, marginTop: 6, fontSize: 10.5 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.divider,
  },
  priceMetaLabel: { ...Type.meta, color: Brand.textMuted, fontWeight: "600" },
  priceMetaValue: { ...Type.label, color: Brand.text, fontWeight: "700" },
  netBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    marginTop: Space.sm,
  },
  netCopy: { flex: 1 },
  netLabel: { ...Type.label, color: Brand.green, fontWeight: "700" },
  netHint: { ...Type.meta, color: Brand.green, fontSize: 9.5, opacity: 0.8, marginTop: 1 },
  sendPrice: { marginTop: Space.lg },
  billingHint: {
    ...Type.meta,
    color: Brand.textMuted,
    marginTop: Space.sm,
    lineHeight: 15,
    fontSize: 10.5,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  pendingText: {
    fontSize: 12,
    color: Brand.amber,
    fontWeight: "600",
    lineHeight: 17,
  },
  pendingCopy: { flex: 1, gap: 3 },
  pendingHint: {
    fontSize: 10.5,
    color: Brand.amber,
    lineHeight: 15,
    opacity: 0.85,
  },
  cashConfirm: { marginTop: Space.md },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  infoText: {
    flex: 1,
    fontSize: 11.5,
    color: Brand.primary,
    lineHeight: 16,
  },
  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.xxl,
  },
  doneText: {
    flex: 1,
    fontSize: 12,
    color: Brand.green,
    fontWeight: "600",
    lineHeight: 17,
  },
  sheetBox: {
    backgroundColor: Brand.background,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
    paddingVertical: 5,
  },
  sheetLabel: { ...Type.meta, color: Brand.textSecondary },
  sheetValue: { ...Type.meta, color: Brand.text, fontWeight: "700" },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Brand.border,
    marginVertical: Space.xs,
  },
  sheetCash: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  sheetCashText: {
    flex: 1,
    ...Type.meta,
    color: Brand.green,
    lineHeight: 16,
  },
  pressed: { opacity: 0.7 },
});
