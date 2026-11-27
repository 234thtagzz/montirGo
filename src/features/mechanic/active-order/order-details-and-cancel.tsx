import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import type {
  MechanicOrderDetail,
  OrderStatusEvent,
} from '@/features/mechanic/service';
import type { AiAnalysis } from '@/features/service-request/ai';
import { AiAnalysisCard } from '@/features/service-request/components/ai-analysis-card';
import { getStatusMeta } from '@/features/service-request/status';
import { VehicleProfileCard } from '@/features/vehicles/components/vehicle-profile-card';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime, formatIDR } from '@/utils/format';

interface OrderDetailsAndCancelProps {
  order: MechanicOrderDetail;
  history: OrderStatusEvent[];
  analysis: AiAnalysis | null;
  analysisError: string | null;
  analyzing: boolean;
  canCancel: boolean;
  cancelling: boolean;
  onRetryAnalysis: () => void;
  onOpenComplaint: () => void;
  onOpenCancel: () => void;
}

export function OrderDetailsAndCancel({
  order,
  history,
  analysis,
  analysisError,
  analyzing,
  canCancel,
  cancelling,
  onRetryAnalysis,
  onOpenComplaint,
  onOpenCancel,
}: OrderDetailsAndCancelProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const hasVehicle = Boolean(
    order.vehicle_type ||
      order.vehicle_brand ||
      order.vehicle_model ||
      order.vehicle_plate ||
      order.vehicle_photo_url,
  );

  return (
    <View style={styles.wrap}>
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
      <Surface variant="default" padding="lg" style={styles.card}>
        <DetailRow label="Keluhan" value={order.issue_description} />
        {order.symptoms ? <DetailRow label="Gejala" value={order.symptoms} /> : null}
        {!hasVehicle ? (
          <DetailRow label="Kendaraan" value="Tidak dicantumkan" />
        ) : null}
        <DetailRow
          label="Lokasi"
          value={order.address || 'Lokasi GPS terdeteksi'}
        />
        <DetailRow label="WhatsApp" value={order.contact_phone} />
        {order.callout_fee_amount != null ? (
          <DetailRow
            label={`Biaya panggil (${order.callout_fee_tier})`}
            value={formatIDR(order.callout_fee_amount)}
          />
        ) : null}
        {order.additional_notes ? (
          <DetailRow label="Catatan" value={order.additional_notes} />
        ) : null}
        {order.price_amount != null ? (
          <DetailRow
            label="Total Tagihan"
            value={formatIDR(order.price_amount)}
            highlight
            isLast
          />
        ) : null}
      </Surface>

      <SectionHeader eyebrow="AI" title="Analisis awal" />
      <AiAnalysisCard
        analysis={analysis}
        error={analysisError}
        retrying={analyzing}
        onRetry={
          order.status !== 'cancelled' && order.status !== 'paid'
            ? onRetryAnalysis
            : undefined
        }
        subtitle="Indikasi awal — lakukan pemeriksaan langsung"
      />

      {history.length > 0 ? (
        <>
          <SectionHeader eyebrow="RIWAYAT" title="Riwayat status" />
          <Surface variant="default" padding="lg">
            {history.map((event, index) => {
              const eventMeta = getStatusMeta(event.to_status);
              return (
                <View key={event.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: theme.tones[eventMeta.tone].fg },
                      ]}
                    />
                    {index < history.length - 1 ? (
                      <View style={styles.timelineLine} />
                    ) : null}
                  </View>
                  <View style={styles.timelineCopy}>
                    <AppText variant="label">{eventMeta.label}</AppText>
                    {event.notes ? (
                      <AppText variant="caption" tone="secondary">
                        {event.notes}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" tone="muted">
                      {formatDateTime(event.created_at)}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </Surface>
        </>
      ) : null}

      <SectionHeader eyebrow="LAPORAN" title="Laporkan keluhan ke admin" />
      <Surface variant="default" padding="lg" style={styles.reportCard}>
        <View style={styles.reportHead}>
          <View style={styles.reportIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={theme.colors.statusInfoFg}
            />
          </View>
          <AppText variant="caption" tone="secondary" style={styles.reportText}>
            Ada kendala selama perjalanan atau transaksi ini? Laporkan ke admin
            MontirGo.
          </AppText>
        </View>
        <Button
          label="Ajukan Keluhan"
          icon="alert-circle-outline"
          variant="secondary"
          onPress={onOpenComplaint}
        />
      </Surface>

      {canCancel ? (
        <View style={styles.cancelZone}>
          <View style={styles.cancelDivider} />
          <Button
            label="Batalkan Pesanan"
            icon="close-circle-outline"
            variant="dangerSubtle"
            loading={cancelling}
            onPress={onOpenCancel}
          />
          <AppText variant="caption" tone="muted">
            {order.status === 'arrived' && order.quote_status === 'pending_approval'
              ? 'Selama estimasi aktif ditunggu client, pembatalan hanya dibuka setelah batas waktu habis.'
              : 'Gunakan hanya jika kamu benar-benar tidak dapat melanjutkan pekerjaan ini.'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function DetailRow({
  label,
  value,
  highlight = false,
  isLast = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  isLast?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText
        variant={highlight ? 'bodyStrong' : 'body'}
        tone={highlight ? 'info' : 'primary'}
        tabular={highlight}
      >
        {value}
      </AppText>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    gap: theme.spacing.xs,
  },
  card: {
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
  timelineRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
  },
  timelineLeft: {
    width: 16,
    alignItems: 'center' as const,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.borderSubtle,
    marginVertical: 2,
  },
  timelineCopy: {
    flex: 1,
    paddingBottom: theme.spacing.md,
    gap: 2,
  },
  reportCard: {
    gap: theme.spacing.md,
  },
  reportHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  reportIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  reportText: {
    flex: 1,
  },
  cancelZone: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  cancelDivider: {
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
    marginBottom: theme.spacing.xs,
  },
});
