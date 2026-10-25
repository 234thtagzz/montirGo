import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Ionicons } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import {
  Brand,
  CardShadow,
  Radius,
  ScreenPadding,
  Space,
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
  getFinanceSettings,
  type FinanceSettings,
} from "@/features/finance/service";
import {
  analyzeRequest,
  getRequestAnalysis,
  type AiAnalysis,
} from "@/features/service-request/ai";
import { AiAnalysisCard } from "@/features/service-request/components/ai-analysis-card";
import { getStatusMeta } from "@/features/service-request/status";
import { supabase } from "@/lib/supabase";
import { formatDateTime, formatIDR } from "@/utils/format";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function MechanicOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

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
    const channel = supabase
      .channel(`mechanic-order-${id}`)
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
    order != null && ["diagnosing", "repairing", "completed"].includes(order.status);

  const submitPrice = () => {
    if (!order || !canSendPrice) return;
    Alert.alert(
      "Kirim tagihan?",
      `Client akan menerima tagihan ${formatIDR(priceValue)}. ` +
        `Pendapatan bersihmu ${formatIDR(netPrice)} setelah fee ${feePercent}%.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Kirim tagihan",
          onPress: async () => {
            setSendingPrice(true);
            try {
              await setOrderPrice(order.id, priceValue);
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
          },
        },
      ],
    );
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

  const callClient = () => {
    const phone = order?.client_phone ?? order?.contact_phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() =>
      Alert.alert("Gagal", "Tidak dapat membuka aplikasi telepon."),
    );
  };

  const nextAction = order ? getNextAction(order.status) : null;

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
          onPressAction={() => router.replace("/(mechanic)")}
        />
      </View>
    );
  }

  const meta = getStatusMeta(order.status);
  const vehicle = [order.vehicle_brand, order.vehicle_model]
    .filter(Boolean)
    .join(" ");

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Detail Order"
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
              <Text style={[styles.chipText, { color: meta.color }]}>
                {meta.shortLabel}
              </Text>
            </View>
            <Text style={styles.statusTime}>
              {formatDateTime(order.created_at)}
            </Text>
          </View>
          <Text style={styles.statusTitle}>
            {getMechanicProgressLabel(order.status)}
          </Text>
          <Text style={styles.statusSub}>{meta.label}</Text>

          {meta.step > 0 ? (
            <View style={styles.progress}>
              {Array.from({ length: 7 }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.segment,
                    index < meta.step && styles.segmentActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.clientCard}>
          <Avatar name={order.client_name ?? "Client"} size={46} />
          <View style={styles.clientCopy}>
            <Text style={styles.clientName} numberOfLines={1}>
              {order.client_name ?? "Client MontirGo"}
            </Text>
            <Text style={styles.clientRole}>Pelanggan yang kamu tangani</Text>
          </View>
          {order.client_phone || order.contact_phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hubungi pelanggan"
              onPress={callClient}
              style={({ pressed }) => [
                styles.callButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="call" size={17} color={Brand.white} />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.section}>Detail permintaan</Text>
        <View style={styles.detailCard}>
          <DetailRow label="Keluhan" value={order.issue_description} />
          {order.symptoms ? (
            <DetailRow label="Gejala" value={order.symptoms} />
          ) : null}
          <DetailRow label="Kendaraan" value={vehicle || "Tidak dicantumkan"} />
          {order.vehicle_plate ? (
            <DetailRow label="Nomor polisi" value={order.vehicle_plate} />
          ) : null}
          <DetailRow
            label="Lokasi"
            value={order.address || "Lokasi GPS terdeteksi"}
          />
          <DetailRow label="Kontak" value={order.contact_phone} />
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

        <Text style={styles.section}>Tagihan & pembayaran</Text>
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
                style={styles.priceInput}
              />
            </View>
            {priceError ? (
              <Text style={styles.priceError}>{priceError}</Text>
            ) : null}
            <View style={styles.priceMeta}>
              <View style={styles.priceMetaItem}>
                <Text style={styles.priceMetaLabel}>
                  Fee platform ({feePercent}%)
                </Text>
                <Text style={styles.priceMetaValue}>
                  - {formatIDR(platformFee)}
                </Text>
              </View>
              <View style={styles.priceMetaItem}>
                <Text style={styles.priceMetaLabel}>Kamu terima</Text>
                <Text style={styles.priceMetaValueNet}>
                  {formatIDR(netPrice)}
                </Text>
              </View>
            </View>
            <Button
              label="Kirim Tagihan ke Client"
              icon="receipt-outline"
              loading={sendingPrice}
              disabled={!canSendPrice}
              onPress={submitPrice}
              style={styles.sendPrice}
            />
            <Text style={styles.billingHint}>
              Client membayar lewat QRIS / e-wallet Xendit. Saldo masuk sebagai
              pending dan bisa ditarik setelah masa hold.
            </Text>
          </View>
        ) : order.status === "payment" ? (
          <View style={styles.pendingCard}>
            <Ionicons name="time-outline" size={18} color={Brand.amber} />
            <Text style={styles.pendingText}>
              Tagihan {formatIDR(order.price_amount ?? 0)} sudah dikirim. Menunggu
              pembayaran client.
            </Text>
          </View>
        ) : order.status === "paid" ? (
          <View style={styles.doneCard}>
            <Ionicons
              name="checkmark-done-outline"
              size={16}
              color={Brand.green}
            />
            <Text style={styles.doneText}>
              Pembayaran Rp
              {(order.price_amount ?? 0).toLocaleString("id-ID")} sudah lunas.
              Pendapatan masuk ke saldo pending.
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
              Tagihan bisa dikirim saat pekerjaan memasuki tahap diagnosis,
              perbaikan, atau selesai.
            </Text>
          </View>
        )}

        <Text style={styles.section}>Analisis AI</Text>
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
            <Text style={styles.section}>Riwayat status</Text>
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

        {nextAction ? (
          <Button
            label={nextAction.label}
            icon={nextAction.icon}
            loading={updating}
            onPress={advance}
            style={styles.action}
          />
        ) : canEditPrice ? null : (
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
  statusCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    ...CardShadow,
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chipText: { fontSize: 10.5, fontWeight: "700" },
  statusTime: { fontSize: 11, color: Brand.textMuted },
  statusTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Brand.text,
    marginTop: Space.md,
  },
  statusSub: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  progress: { flexDirection: "row", gap: 4, marginTop: Space.md },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.divider,
  },
  segmentActive: { backgroundColor: Brand.primary },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginTop: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  clientCopy: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: "700", color: Brand.text },
  clientRole: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.green,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    fontSize: 14,
    fontWeight: "700",
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
    borderColor: Brand.divider,
    padding: Space.lg,
  },
  billingLabel: {
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: "700",
    color: Brand.textSecondary,
  },
  priceInput: {
    flex: 1,
    minHeight: 46,
    fontSize: 20,
    fontWeight: "700",
    color: Brand.text,
    paddingVertical: 0,
  },
  priceError: { fontSize: 11, color: Brand.red, marginTop: 6 },
  priceMeta: {
    flexDirection: "row",
    gap: Space.md,
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.divider,
  },
  priceMetaItem: { flex: 1 },
  priceMetaLabel: { fontSize: 10.5, color: Brand.textMuted, fontWeight: "600" },
  priceMetaValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Brand.text,
    marginTop: 2,
  },
  priceMetaValueNet: {
    fontSize: 14,
    fontWeight: "700",
    color: Brand.green,
    marginTop: 2,
  },
  sendPrice: { marginTop: Space.lg },
  billingHint: {
    fontSize: 10.5,
    color: Brand.textMuted,
    marginTop: Space.sm,
    lineHeight: 15,
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
    flex: 1,
    fontSize: 12,
    color: Brand.amber,
    fontWeight: "600",
    lineHeight: 17,
  },
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
  pressed: { opacity: 0.7 },
});
