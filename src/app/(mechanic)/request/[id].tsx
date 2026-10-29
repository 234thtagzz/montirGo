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
import { ScreenHeader } from '@/components/ui/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, ScreenPadding, Space } from '@/constants/brand';
import { supabase } from '@/lib/supabase';
import {
  acceptOrder,
  getIncomingRequestDetail,
  type IncomingRequestDetail,
} from '@/features/mechanic/service';
import { AiAnalysisCard } from '@/features/service-request/components/ai-analysis-card';
import { formatDateTime } from '@/utils/format';
import { openWhatsApp } from '@/utils/whatsapp';

/**
 * Layar otorisasi montir: detail request SEBELUM diterima.
 * Menampilkan data client + kendaraan + hasil analisis AI, lalu CTA "Terima Order".
 */
export default function MechanicRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<IncomingRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const detail = await getIncomingRequestDetail(id);
      setOrder(detail);
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
    const channel = supabase
      .channel(`mechanic-request-${id}`)
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

  const confirmAccept = () => {
    if (!order) return;
    Alert.alert(
      'Terima request ini?',
      'Pastikan kamu bisa menuju lokasi client. Setelah diterima, request akan menjadi order aktifmu.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, terima',
          onPress: async () => {
            setAccepting(true);
            try {
              await acceptOrder(order.id);
              // Langsung masuk mode perjalanan: montir melihat rute + ETA, lalu
              // menekan "Mulai Perjalanan" saat benar-benar berangkat.
              router.replace({
                pathname: '/(mechanic)/trip/[id]',
                params: { id: order.id },
              });
            } catch (e) {
              Alert.alert(
                'Gagal menerima',
                e instanceof Error ? e.message : 'Request mungkin sudah diambil montir lain.',
              );
              await load();
            } finally {
              setAccepting(false);
            }
          },
        },
      ],
    );
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
          onPressAction={() => router.replace('/(mechanic)/requests')}
        />
      </View>
    );
  }

  const vehicle = [order.vehicle_brand, order.vehicle_model, order.vehicle_year]
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' ');

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Detail Request"
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
            <View style={styles.newChip}>
              <Ionicons name="flash-outline" size={12} color={Brand.amber} />
              <Text style={styles.newChipText}>Request baru</Text>
            </View>
            <Text style={styles.statusTime}>{formatDateTime(order.created_at)}</Text>
          </View>
          <Text style={styles.statusTitle}>Menunggu montir menerima</Text>
          <Text style={styles.statusSub}>
            Periksa keluhan dan analisis AI sebelum memutuskan untuk menerima.
          </Text>
        </View>

        <View style={styles.clientCard}>
          <Avatar name={order.client_name ?? 'Client'} size={46} />
          <View style={styles.clientCopy}>
            <Text style={styles.clientName} numberOfLines={1}>
              {order.client_name ?? 'Client MontirGo'}
            </Text>
            <Text style={styles.clientRole}>Client yang membutuhkan bantuan</Text>
          </View>
          {order.contact_phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hubungi client lewat WhatsApp"
              onPress={chatClient}
              style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
            >
              <Ionicons name="logo-whatsapp" size={18} color={Brand.white} />
            </Pressable>
          ) : null}
        </View>

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
        </View>

        <Text style={styles.section}>Hasil analisis AI</Text>
        <AiAnalysisCard
          analysis={order.ai_analysis}
          subtitle="Indikasi awal untuk membantumu memutuskan"
        />

        <View style={styles.disclaimer}>
          <Ionicons name="shield-checkmark-outline" size={15} color={Brand.primary} />
          <Text style={styles.disclaimerText}>
            Analisis AI bukan diagnosis final. Lakukan pemeriksaan langsung saat tiba di lokasi.
          </Text>
        </View>

        <Button
          label={accepting ? 'Memproses...' : 'Terima Order'}
          icon="checkmark-circle-outline"
          loading={accepting}
          onPress={confirmAccept}
          style={styles.action}
        />
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
  newChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Brand.amberSoft,
  },
  newChipText: { fontSize: 10.5, fontWeight: '700', color: Brand.amber },
  statusTime: { fontSize: 11, color: Brand.textMuted },
  statusTitle: { fontSize: 17, fontWeight: '700', color: Brand.text, marginTop: Space.md },
  statusSub: { fontSize: 12, color: Brand.textSecondary, marginTop: 2, lineHeight: 17 },
  clientCard: {
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
  clientCopy: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: '700', color: Brand.text },
  clientRole: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  chatButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.whatsapp,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  disclaimer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.lg,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: Brand.primary, lineHeight: 16 },
  action: { marginTop: Space.xl },
  pressed: { opacity: 0.7 },
});
