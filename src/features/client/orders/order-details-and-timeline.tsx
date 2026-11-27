import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { SectionHeader } from '@/components/ui/section-header';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import type { ClientOrder, OrderStatusEvent } from '@/features/client/types';
import type { AiAnalysis } from '@/features/service-request/ai';
import { AiAnalysisCard } from '@/features/service-request/components/ai-analysis-card';
import { getStatusMeta, isCancellable } from '@/features/service-request/status';
import { VehicleProfileCard } from '@/features/vehicles/components/vehicle-profile-card';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime, formatIDR } from '@/utils/format';

const TIER_NAME: Record<string, string> = {
  motor: 'Motor',
  mobil: 'Mobil',
  derek: 'Derek / Towing',
};

interface OrderDetailsAndTimelineProps {
  order: ClientOrder;
  history: OrderStatusEvent[];
  analysis: AiAnalysis | null;
  analysisError: string | null;
  analyzing: boolean;
  cancelling: boolean;
  onRetryAnalysis: () => void;
  onOpenComplaint: () => void;
  onOpenCancel: () => void;
}

export function OrderDetailsAndTimeline({
  order,
  history,
  analysis,
  analysisError,
  analyzing,
  cancelling,
  onRetryAnalysis,
  onOpenComplaint,
  onOpenCancel,
}: OrderDetailsAndTimelineProps) {
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
      <Surface variant="default" padding="lg" style={styles.detailCard}>
        <DetailRow label="Keluhan" value={order.issue_description} />
        {order.symptoms ? <DetailRow label="Gejala" value={order.symptoms} /> : null}
        {!hasVehicle ? <DetailRow label="Kendaraan" value="Tidak dicantumkan" /> : null}
        <DetailRow
          label="Biaya panggil pasti"
          value={`${TIER_NAME[order.callout_fee_tier] ?? 'Motor'} · ${formatIDR(order.callout_fee_amount)}`}
          highlight
        />
        <DetailRow label="Lokasi" value={order.address || 'Lokasi GPS terdeteksi'} />
        <DetailRow label="WhatsApp" value={order.contact_phone} />
        {order.additional_notes ? (
          <DetailRow label="Catatan" value={order.additional_notes} />
        ) : null}
        {order.price_amount != null ? (
          <DetailRow label="Total tagihan" value={formatIDR(order.price_amount)} highlight isLast />
        ) : null}
      </Surface>

      <SectionHeader eyebrow="DIAGNOSA" title="Analisis AI" />
      <AiAnalysisCard
        analysis={analysis}
        error={analysisError}
        retrying={analyzing}
        onRetry={
          order.status !== 'cancelled' && order.status !== 'paid' ? onRetryAnalysis : undefined
        }
      />

      {history.length > 0 ? (
        <>
          <SectionHeader eyebrow="PERJALANAN" title="Riwayat status" />
          <Surface variant="default" padding="lg">
            {history.map((event, index) => {
              const eventMeta = getStatusMeta(event.to_status);
              const dotColor = theme.tones[eventMeta.tone].fg;
              return (
                <View key={event.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                    {index < history.length - 1 ? <View style={styles.timelineLine} /> : null}
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

      <SectionHeader eyebrow="LAPORAN" title="Keluhan transaksi" />
      <Surface variant="default" padding="lg" style={styles.reportCard}>
        <View style={styles.reportHead}>
          <View style={styles.reportIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.statusInfoFg} />
          </View>
          <AppText variant="body" tone="secondary" style={styles.flexCopy}>
            Ada kendala dengan transaksi ini? Laporkan langsung ke admin MontirGo — termasuk untuk pesanan biaya panggil saja.
          </AppText>
        </View>
        <Button
          label="Ajukan Keluhan"
          icon="alert-circle-outline"
          variant="secondary"
          onPress={onOpenComplaint}
        />
      </Surface>

      {isCancellable(order.status) ? (
        <Button
          label="Batalkan Pesanan"
          variant="danger"
          icon="close-circle-outline"
          loading={cancelling}
          onPress={onOpenCancel}
          style={styles.cancel}
        />
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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText
        variant={highlight ? 'title' : 'body'}
        tone={highlight ? 'info' : 'primary'}
        style={highlight ? theme.tabularNums : undefined}
      >
        {value}
      </AppText>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    gap: theme.spacing.md,
  },
  detailCard: {
    paddingVertical: theme.spacing.xs,
  },
  detailRow: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: theme.spacing.xxs,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  timelineLeft: {
    alignItems: 'center' as const,
    width: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.borderSubtle,
    marginTop: theme.spacing.xxs,
  },
  timelineCopy: {
    flex: 1,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xxs,
  },
  reportCard: {
    gap: theme.spacing.md,
  },
  reportHead: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    alignItems: 'flex-start' as const,
  },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  flexCopy: { flex: 1 },
  cancel: {
    marginTop: theme.spacing.md,
  },
});
