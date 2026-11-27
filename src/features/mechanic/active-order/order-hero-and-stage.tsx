import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { SwipeAction } from '@/components/ui/swipe-action';
import { AppText } from '@/components/ui/text';
import { AssignmentPendingCard } from '@/features/mechanic/components/assignment-pending-card';
import { TripEntryCard } from '@/features/mechanic/components/trip/trip-entry-card';
import { getMechanicProgressLabel } from '@/features/mechanic/constants';
import type { MechanicOrderDetail } from '@/features/mechanic/service';
import {
  getQuoteStatusMeta,
  getStatusMeta,
  TOTAL_STEPS,
} from '@/features/service-request/status';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface OrderHeroAndStageProps {
  order: MechanicOrderDetail;
  updatingStage: boolean;
  onChatClient: () => void;
  onOpenTrip: () => void;
  onAdvanceStage: (toStatus: 'on_the_way' | 'arrived') => void;
}

export function OrderHeroAndStage({
  order,
  updatingStage,
  onChatClient,
  onOpenTrip,
  onAdvanceStage,
}: OrderHeroAndStageProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const meta = getStatusMeta(order.status);
  const quoteMeta = getQuoteStatusMeta(order.quote_status);
  const heroTitle = getMechanicProgressLabel(order.status, order.quote_status);
  const pendingConfirmation = order.status === 'mechanic_assigned';
  const tripStatus: 'mechanic_accepted' | 'on_the_way' | null =
    order.status === 'mechanic_accepted' || order.status === 'on_the_way'
      ? order.status
      : null;

  const heroSub =
    order.status === 'paid'
      ? order.payment_method === 'cash'
        ? 'Dibayar tunai oleh pelanggan'
        : 'Pembayaran online terverifikasi'
      : order.status === 'payment'
        ? order.payment_method === 'cash'
          ? 'Pelanggan memilih pembayaran tunai'
          : 'Menunggu pembayaran dari pelanggan'
        : order.status === 'arrived'
          ? quoteMeta.label
          : order.status === 'cancelled'
            ? null
            : meta.label;

  return (
    <View style={styles.container}>
      <Surface variant="elevated" padding="lg" style={styles.hero}>
        <View style={styles.heroTop}>
          <Badge
            size="sm"
            dot
            tone={order.status === 'arrived' ? quoteMeta.tone : meta.tone}
            label={order.status === 'arrived' ? quoteMeta.shortLabel : meta.shortLabel}
          />
          <AppText variant="caption" tone="muted">
            {formatDateTime(order.created_at)}
          </AppText>
        </View>

        <AppText variant="h2" style={styles.heroTitle}>
          {heroTitle}
        </AppText>
        {heroSub ? (
          <AppText variant="caption" tone="secondary">
            {heroSub}
          </AppText>
        ) : null}

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
            <AppText variant="caption" tone="muted" tabular>
              Tahap {meta.step} dari {TOTAL_STEPS}
            </AppText>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.clientRow}>
          <Avatar name={order.client_name ?? 'Client'} size={42} />
          <View style={styles.clientCopy}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {order.client_name ?? 'Client MontirGo'}
            </AppText>
            <AppText variant="caption" tone="secondary">
              Pelanggan yang kamu tangani
            </AppText>
          </View>
          {order.client_phone || order.contact_phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hubungi pelanggan lewat WhatsApp"
              onPress={onChatClient}
              style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
            >
              <Ionicons
                name="logo-whatsapp"
                size={20}
                color={theme.colors.statusSuccessFg}
              />
            </Pressable>
          ) : null}
        </View>
      </Surface>

      {pendingConfirmation ? (
        <AssignmentPendingCard expiresAt={order.assignment_expires_at} />
      ) : tripStatus ? (
        <>
          <TripEntryCard status={tripStatus} onPress={onOpenTrip} />
          <Surface variant="default" padding="lg" style={styles.swipeBox}>
            <AppText variant="label" tone="secondary" style={styles.swipeHint}>
              {tripStatus === 'mechanic_accepted'
                ? 'Sudah siap berangkat menuju lokasi client?'
                : 'Sudah benar-benar tiba dan bertemu kendaraan client?'}
            </AppText>
            <SwipeAction
              label={
                tripStatus === 'mechanic_accepted'
                  ? 'Geser: Mulai Perjalanan'
                  : 'Geser: Sampai di Lokasi'
              }
              completedLabel={
                tripStatus === 'mechanic_accepted'
                  ? 'Memulai perjalanan…'
                  : 'Mencatat kedatangan…'
              }
              icon={
                tripStatus === 'mechanic_accepted'
                  ? 'navigate-outline'
                  : 'location-outline'
              }
              tone={tripStatus === 'on_the_way' ? 'success' : 'primary'}
              edgeInset={20}
              loading={updatingStage}
              onConfirm={() =>
                onAdvanceStage(
                  tripStatus === 'mechanic_accepted' ? 'on_the_way' : 'arrived',
                )
              }
            />
          </Surface>
        </>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  container: {
    gap: theme.spacing.sm,
  },
  hero: {
    gap: theme.spacing.xs,
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  heroTitle: {
    marginTop: theme.spacing.xs,
  },
  progressWrap: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  progress: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  segmentActive: {
    backgroundColor: theme.colors.actionPrimaryBg,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
    marginVertical: theme.spacing.md,
  },
  clientRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  clientCopy: {
    flex: 1,
    gap: 2,
  },
  chatButton: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.statusSuccessBg,
    borderWidth: 1,
    borderColor: theme.colors.statusSuccessBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  swipeBox: {
    gap: theme.spacing.md,
  },
  swipeHint: {
    textAlign: 'center' as const,
  },
  pressed: {
    opacity: 0.78,
  },
});
