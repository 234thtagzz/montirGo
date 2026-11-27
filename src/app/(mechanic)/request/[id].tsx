import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import {
  acceptOrder,
  ACTIVE_ORDER_MESSAGE,
  getIncomingRequestDetail,
  getMyActiveOrderId,
  type IncomingRequestDetail,
} from '@/features/mechanic/service';
import { AiAnalysisCard } from '@/features/service-request/components/ai-analysis-card';
import { VehicleProfileCard } from '@/features/vehicles/components/vehicle-profile-card';
import { useRefreshOnForeground } from '@/hooks/use-foreground';
import { createRealtimeChannel, subscribeWithResync } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime, formatMonthYear } from '@/utils/format';

/**
 * Layar otorisasi montir: detail request SEBELUM diterima.
 * Menampilkan data client, kendaraan, dan analisis AI, lalu tombol 56px Ajukan Diri.
 */
export default function MechanicRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

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
      void load();
    }, [load]),
  );

  useRefreshOnForeground(() => {
    void load();
  });

  useEffect(() => {
    if (!id) return;
    const channel = createRealtimeChannel(`mechanic-request-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${id}` },
        () => void load(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_diagnoses', filter: `request_id=eq.${id}` },
        () => void load(),
      );
    subscribeWithResync(channel, () => void load());
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const openConfirm = () => {
    if (!order) return;
    if (activeOrderId) {
      showToast({
        tone: 'warning',
        title: 'Masih ada order aktif',
        message: ACTIVE_ORDER_MESSAGE,
        actionLabel: 'Buka Order',
        onAction: () => router.push(`/(mechanic)/active-order/${activeOrderId}`),
      });
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
      showToast({
        tone: 'success',
        title: 'Pengajuan terkirim',
        message: 'Menunggu konfirmasi client dalam 5 menit.',
      });
      router.replace({
        pathname: '/(mechanic)/active-order/[id]',
        params: { id: order.id },
      });
    } catch (e) {
      setConfirmOpen(false);
      showToast({
        tone: 'danger',
        title: 'Gagal mengajukan diri',
        message:
          e instanceof Error ? e.message : 'Request mungkin sudah diambil montir lain.',
      });
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
        <ErrorState onRetry={() => void load()} />
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

  const clientMeta = [
    order.client_joined_at ? `Klien sejak ${formatMonthYear(order.client_joined_at)}` : null,
    order.client_total_requests != null ? `${order.client_total_requests} pesanan` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const hasVehicle = Boolean(
    order.vehicle_type ||
      order.vehicle_brand ||
      order.vehicle_model ||
      order.vehicle_photo_url,
  );

  const areaLabel = [
    order.address_area || 'Area sekitar client',
    order.distance_km != null ? `± ${order.distance_km.toFixed(1)} km` : null,
  ]
    .filter(Boolean)
    .join(' · ');

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
              void load();
            }}
            tintColor={theme.colors.actionPrimaryBg}
            colors={[theme.colors.actionPrimaryBg]}
          />
        }
      >
        <Surface variant="elevated" padding="lg" style={styles.hero}>
          <View style={styles.heroTop}>
            <Badge size="sm" dot tone="warning" label="REQUEST BARU" />
            <AppText variant="caption" tone="muted">
              {formatDateTime(order.created_at)}
            </AppText>
          </View>

          <AppText variant="h2" style={styles.heroTitle}>
            Menunggu montir menerima
          </AppText>
          <AppText variant="caption" tone="secondary">
            Periksa keluhan dan analisis awal sebelum mengajukan diri ke client.
          </AppText>

          <View style={styles.heroDivider} />

          <View style={styles.heroClient}>
            <Avatar
              name={order.client_name ?? 'Client'}
              uri={order.client_avatar_url}
              size={44}
            />
            <View style={styles.heroClientCopy}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {order.client_name ?? 'Client MontirGo'}
              </AppText>
              <AppText variant="caption" tone="secondary">
                Client yang membutuhkan bantuan
              </AppText>
              {clientMeta ? (
                <AppText variant="caption" tone="muted" numberOfLines={1}>
                  {clientMeta}
                </AppText>
              ) : null}
            </View>
          </View>
        </Surface>

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
            />
          </>
        ) : null}

        <SectionHeader eyebrow="KELUHAN" title="Detail permintaan" />
        <Surface variant="default" padding="lg" style={styles.detailCard}>
          <DetailRow label="Keluhan" value={order.issue_description} />
          {order.symptoms ? <DetailRow label="Gejala" value={order.symptoms} /> : null}
          {!hasVehicle ? <DetailRow label="Kendaraan" value="Tidak dicantumkan" /> : null}
          <DetailRow label="Area & jarak" value={areaLabel} />
          <DetailRow
            label="Kontak & titik tepat"
            value="Tersedia otomatis setelah client menyetujui pengajuanmu."
          />
          {order.additional_notes ? (
            <DetailRow label="Catatan" value={order.additional_notes} isLast />
          ) : null}
        </Surface>

        <SectionHeader eyebrow="AI" title="Analisis awal" />
        <AiAnalysisCard
          analysis={order.ai_analysis}
          subtitle="Indikasi awal untuk membantumu memutuskan"
        />

        <Surface variant="outlined" padding="md" style={styles.disclaimer}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={theme.colors.statusInfoFg}
          />
          <AppText variant="caption" tone="secondary" style={styles.disclaimerText}>
            Analisis AI bukan diagnosis final. Lakukan pemeriksaan langsung saat tiba di lokasi.
          </AppText>
        </Surface>

        {activeOrderId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka order aktif yang sedang berjalan"
            onPress={() => router.push(`/(mechanic)/active-order/${activeOrderId}`)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Surface variant="outlined" padding="md" style={styles.notice}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={theme.colors.statusWarningFg}
              />
              <View style={styles.noticeCopy}>
                <AppText variant="label">Selesaikan order aktif dulu</AppText>
                <AppText variant="caption" tone="secondary">
                  Kamu hanya bisa memegang satu order. Order #
                  {activeOrderId.slice(0, 8).toUpperCase()} masih berjalan.
                </AppText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.statusWarningFg}
              />
            </Surface>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
        <Button
          label={activeOrderId ? 'Selesaikan Order Dulu' : 'Ajukan Diri'}
          icon="paper-plane-outline"
          variant="primary"
          size="cta"
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
        onConfirm={() => void submitAccept()}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );
}

function DetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="body" style={styles.detailValue}>
        {value}
      </AppText>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    padding: theme.spacing.screenPadding,
  },
  hero: {
    gap: theme.spacing.xs,
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  heroTitle: {
    marginTop: theme.spacing.xs,
  },
  heroDivider: {
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
    marginVertical: theme.spacing.md,
  },
  heroClient: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  heroClientCopy: {
    flex: 1,
    gap: 2,
  },
  detailCard: {
    paddingVertical: theme.spacing.xs,
  },
  detailRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: 2,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailValue: {
    lineHeight: 20,
  },
  disclaimer: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    alignItems: 'flex-start' as const,
    backgroundColor: theme.colors.statusInfoBg,
    borderColor: theme.colors.statusInfoBorder,
    marginTop: theme.spacing.lg,
  },
  disclaimerText: {
    flex: 1,
  },
  notice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
    marginTop: theme.spacing.md,
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  footer: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.bgCanvas,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  pressed: {
    opacity: 0.78,
  },
});
