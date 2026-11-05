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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { createRealtimeChannel } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import {
  acceptOrder,
  ACTIVE_ORDER_MESSAGE,
  getIncomingRequestDetail,
  getMyActiveOrderId,
  type IncomingRequestDetail,
} from '@/features/mechanic/service';
import { AiAnalysisCard } from '@/features/service-request/components/ai-analysis-card';
import { VehicleProfileCard } from '@/features/vehicles/components/vehicle-profile-card';
import { formatDateTime } from '@/utils/format';
import { openWhatsApp } from '@/utils/whatsapp';

/**
 * Layar otorisasi montir: detail request SEBELUM diterima.
 * Menampilkan data client + kendaraan + hasil analisis AI, lalu CTA "Ajukan".
 */
export default function MechanicRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<IncomingRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, activeId] = await Promise.all([
        getIncomingRequestDetail(id),
        getMyActiveOrderId().catch(() => null),
      ]);
      setOrder(detail);
      setActiveOrderId(activeId);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Realtime: request diambil montir lain, dibatalkan, atau analisis AI selesai.
  useEffect(() => {
    if (!id) return;
    const channel = createRealtimeChannel(`mechanic-request-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_diagnoses', filter: `request_id=eq.${id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const chatClient = () => {
    if (!order) return;
    void openWhatsApp(
      order.contact_phone,
      `Halo, saya montir MontirGo. Saya ingin menanyakan permintaan #${order.id
        .slice(0, 8)
        .toUpperCase()} sebelum berangkat.`,
    );
  };

  const openConfirm = () => {
    if (!order) return;
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
    setConfirmOpen(true);
  };

  const submitAccept = async () => {
    if (!order) return;
    setAccepting(true);
    try {
      await acceptOrder(order.id);
      setConfirmOpen(false);
      // Pengajuan belum menjadi order aktif sampai client menyetujui.
      router.replace({
        pathname: '/(mechanic)/active-order/[id]',
        params: { id: order.id },
      });
      Alert.alert(
        'Pengajuan terkirim',
        'Menunggu konfirmasi client. Kamu akan mendapat notifikasi begitu disetujui.',
      );
    } catch (e) {
      Alert.alert(
        'Gagal mengajukan',
        e instanceof Error ? e.message : 'Request mungkin sudah diambil montir lain.',
      );
      await load();
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Request" />
        <LoadingState message="Memuat request..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Request" />
        <ErrorState onRetry={load} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Detail Request" />
        <EmptyState
          icon="time-outline"
          message="Request sudah tidak tersedia"
          hint="Mungkin sudah diambil montir lain atau dibatalkan oleh client."
          actionLabel="Kembali ke Request"
          onPressAction={() => router.replace('/(mechanic)/(tabs)/requests')}
        />
      </View>
    );
  }

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
        title="Detail Request"
        subtitle={`#${order.id.slice(0, 8).toUpperCase()}`}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
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
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>REQUEST BARU</Text>
            </View>
            <Text style={styles.heroTime}>{formatDateTime(order.created_at)}</Text>
          </View>

          <Text style={styles.heroTitle}>Menunggu montir menerima</Text>
          <Text style={styles.heroSub}>
            Periksa keluhan dan analisis awal sebelum mengajukan diri ke client.
          </Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroClient}>
            <Avatar name={order.client_name ?? 'Client'} size={42} />
            <View style={styles.heroClientCopy}>
              <Text style={styles.heroClientName} numberOfLines={1}>
                {order.client_name ?? 'Client MontirGo'}
              </Text>
              <Text style={styles.heroClientRole}>Client yang membutuhkan bantuan</Text>
            </View>
            {order.contact_phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hubungi client lewat WhatsApp"
                onPress={chatClient}
                style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
              >
                <Ionicons name="logo-whatsapp" size={19} color={Brand.ink} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {hasVehicle ? (
          <>
            <SectionHeader eyebrow="KENDARAAN" title="Data kendaraan" />
            <VehicleProfileCard
              title="Kendaraan client"
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
          {order.symptoms ? <DetailRow label="Gejala" value={order.symptoms} /> : null}
          {!hasVehicle ? <DetailRow label="Kendaraan" value="Tidak dicantumkan" /> : null}
          <DetailRow label="Lokasi" value={order.address || 'Lokasi GPS terdeteksi'} />
          <DetailRow label="WhatsApp" value={order.contact_phone} />
          {order.additional_notes ? (
            <DetailRow label="Catatan" value={order.additional_notes} />
          ) : null}
        </View>

        <SectionHeader eyebrow="AI" title="Analisis awal" />
        <AiAnalysisCard
          analysis={order.ai_analysis}
          subtitle="Indikasi awal untuk membantumu memutuskan"
        />

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={15} color={Brand.primary} />
          <Text style={styles.disclaimerText}>
            Analisis AI bukan diagnosis final. Lakukan pemeriksaan langsung saat tiba di lokasi.
          </Text>
        </View>

        {activeOrderId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka order aktif yang sedang berjalan"
            onPress={() => router.push(`/(mechanic)/active-order/${activeOrderId}`)}
            style={({ pressed }) => [styles.notice, pressed && styles.pressed]}
          >
            <Ionicons name="lock-closed-outline" size={16} color={Brand.amber} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>Selesaikan order aktif dulu</Text>
              <Text style={styles.noticeText}>
                Kamu hanya bisa memegang satu order. Request ini bisa diterima setelah order #
                {activeOrderId.slice(0, 8).toUpperCase()} lunas.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={Brand.amber} />
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Space.md }]}>
        <Button
          label={activeOrderId ? 'Selesaikan Order Dulu' : 'Ajukan ke Client'}
          icon="paper-plane-outline"
          variant="ink"
          loading={accepting}
          disabled={activeOrderId != null}
          onPress={openConfirm}
        />
      </View>

      <ConfirmSheet
        visible={confirmOpen}
        title="Ajukan mengambil request?"
        message="Client akan meninjau rating, ulasan, dan profil bengkelmu lalu mengonfirmasi dalam 5 menit. Kamu baru bisa berangkat setelah pengajuan disetujui."
        confirmLabel="Ya, ajukan"
        icon="paper-plane-outline"
        loading={accepting}
        onConfirm={submitAccept}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding },
  hero: {
    backgroundColor: Brand.ink,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Brand.inkBorder,
    padding: Space.lg,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.volt },
  liveText: { ...Type.micro, color: Brand.volt, fontSize: 9.5 },
  heroTime: { ...Type.meta, color: Brand.inkMuted, fontSize: 10 },
  heroTitle: { ...Type.h2, color: Brand.white, marginTop: Space.md },
  heroSub: { ...Type.meta, color: Brand.inkMuted, marginTop: 3, lineHeight: 17 },
  heroDivider: {
    height: 1,
    backgroundColor: Brand.inkBorder,
    marginVertical: Space.lg,
  },
  heroClient: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  heroClientCopy: { flex: 1 },
  heroClientName: { ...Type.bodyStrong, color: Brand.white, fontWeight: '700' },
  heroClientRole: { ...Type.meta, color: Brand.inkMuted, marginTop: 2 },
  chatButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.whatsapp,
    alignItems: 'center',
    justifyContent: 'center',
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
  detailLabel: { ...Type.meta, color: Brand.textMuted, fontWeight: '600', fontSize: 10.5 },
  detailValue: { ...Type.body, color: Brand.text, marginTop: 3, lineHeight: 20, fontSize: 13.5 },
  disclaimer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.lg,
  },
  disclaimerText: { flex: 1, ...Type.meta, color: Brand.primaryDark, lineHeight: 16 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.lg,
  },
  noticeCopy: { flex: 1 },
  noticeTitle: { ...Type.label, color: Brand.text, fontWeight: '700' },
  noticeText: { ...Type.meta, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: ScreenPadding,
    paddingTop: Space.md,
    backgroundColor: Brand.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
  },
  pressed: { opacity: 0.72 },
});
