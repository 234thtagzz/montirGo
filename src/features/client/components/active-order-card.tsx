import { ActivityIndicator, Pressable, View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import type { ClientOrder } from '@/features/client/types';
import {
  getProgressLabel,
  getQuoteStatusMeta,
  getStatusMeta,
  TOTAL_STEPS,
} from '@/features/service-request/status';
import { formatVehicleLabel } from '@/features/vehicles/constants';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface ActiveOrderCardProps {
  order: ClientOrder;
  onPress: () => void;
}

/**
 * Kartu pesanan aktif menonjol di bagian atas Beranda Client.
 */
export function ActiveOrderCard({ order, onPress }: ActiveOrderCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const meta = getStatusMeta(order.status);
  const quoteMeta =
    order.status === 'arrived' ? getQuoteStatusMeta(order.quote_status) : null;
  const hasMechanic = Boolean(order.mechanic_id);
  const pendingConfirmation = order.status === 'mechanic_assigned' && hasMechanic;
  const pendingQuoteApproval =
    order.status === 'arrived' && order.quote_status === 'pending_approval';
  const vehicle = formatVehicleLabel(
    order.vehicle_type,
    order.vehicle_brand,
    order.vehicle_model,
  );
  const accentColor = pendingConfirmation || pendingQuoteApproval
    ? theme.colors.statusWarningFg
    : theme.tones[meta.tone].fg;

  const actionLabel = pendingConfirmation
    ? 'Konfirmasi'
    : pendingQuoteApproval
      ? 'Tinjau Estimasi'
      : order.status === 'on_the_way'
        ? 'Lacak Peta'
        : 'Detail';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pesanan aktif: ${getProgressLabel(order.status)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        theme.elevation.card,
        { borderLeftColor: accentColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.top}>
          <Badge label={meta.shortLabel} tone={meta.tone} icon={meta.icon} size="sm" />
          <AppText variant="caption" tone="muted" style={theme.tabularNums}>
            {formatDateTime(order.created_at)}
          </AppText>
        </View>

        {quoteMeta ? (
          <View style={styles.quoteBadgeRow}>
            <Badge
              label={quoteMeta.shortLabel}
              tone={quoteMeta.tone}
              icon={quoteMeta.icon}
              size="sm"
            />
          </View>
        ) : null}

        {meta.step > 0 ? (
          <View style={styles.progress}>
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.segment,
                  index < meta.step && { backgroundColor: accentColor },
                ]}
              />
            ))}
          </View>
        ) : null}

        <AppText variant="title" style={styles.title}>
          {pendingQuoteApproval
            ? 'Estimasi biaya menunggu persetujuanmu'
            : getProgressLabel(order.status)}
        </AppText>
        <AppText variant="body" tone="secondary" numberOfLines={1}>
          {vehicle ? `${vehicle} · ` : ''}
          {order.issue_description}
        </AppText>

        <View style={styles.footer}>
          <View style={styles.mechanicRow}>
            {hasMechanic ? (
              <>
                <Avatar
                  name={order.mechanic_name ?? 'Montir'}
                  uri={order.mechanic_avatar}
                  size={32}
                />
                <View style={styles.mechanicText}>
                  <AppText variant="label" numberOfLines={1}>
                    {order.mechanic_name ?? 'Montir MontirGo'}
                  </AppText>
                  <AppText
                    variant="caption"
                    tone={pendingConfirmation ? 'warning' : 'muted'}
                  >
                    {pendingConfirmation
                      ? 'Menunggu konfirmasimu'
                      : order.status === 'arrived'
                        ? 'Sedang di lokasi'
                        : 'Montir ditugaskan'}
                  </AppText>
                </View>
              </>
            ) : (
              <>
                <View style={styles.searching}>
                  <ActivityIndicator size="small" color={theme.colors.actionPrimaryAltBg} />
                </View>
                <AppText variant="label" tone="secondary">
                  Mencari montir terdekat…
                </AppText>
              </>
            )}
          </View>

          <View style={styles.actionPill}>
            <AppText variant="label" tone="inverse">
              {actionLabel}
            </AppText>
            <Ionicons name="arrow-forward" size={14} color={theme.colors.actionPrimaryFg} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderLeftWidth: 4,
    overflow: 'hidden' as const,
  },
  pressed: { opacity: 0.82 },
  inner: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  top: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  quoteBadgeRow: {
    marginTop: theme.spacing.xxs,
  },
  progress: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderSubtle,
  },
  title: {
    marginTop: theme.spacing.xs,
  },
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  mechanicRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    flex: 1,
  },
  mechanicText: {
    flex: 1,
  },
  searching: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    minHeight: 40,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.actionPrimaryBg,
  },
});
