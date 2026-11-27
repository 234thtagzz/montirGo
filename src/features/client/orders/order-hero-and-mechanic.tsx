import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import type { AssignedOrderMechanic, ClientOrder } from '@/features/client/types';
import { ClientTripEntryCard } from '@/features/client/components/tracking/client-trip-entry-card';
import {
  getProgressLabel,
  getQuoteStatusMeta,
  getStatusMeta,
  TOTAL_STEPS,
} from '@/features/service-request/status';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime, formatIDR } from '@/utils/format';

interface OrderHeroAndMechanicProps {
  order: ClientOrder;
  assignedMechanic: AssignedOrderMechanic | null;
  paidWithCash: boolean;
  cashSelected: boolean;
  onOpenTracking: () => void;
  onOpenAssignment: () => void;
  onChatMechanic: () => void;
}

export function OrderHeroAndMechanic({
  order,
  assignedMechanic,
  paidWithCash,
  cashSelected,
  onOpenTracking,
  onOpenAssignment,
  onChatMechanic,
}: OrderHeroAndMechanicProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const meta = getStatusMeta(order.status);
  const quoteMeta =
    order.status === 'arrived' || order.quote_status === 'callout_only'
      ? getQuoteStatusMeta(order.quote_status)
      : null;
  const tonePalette = theme.tones[meta.tone];
  const progressTitle = getProgressLabel(order.status);

  const heroSub =
    order.status === 'paid'
      ? paidWithCash
        ? 'Dibayar tunai langsung ke montir'
        : 'Pembayaran online terverifikasi'
      : order.status === 'payment'
        ? cashSelected
          ? 'Menunggu montir mengonfirmasi uang tunai'
          : 'Silakan selesaikan pembayaran tagihan'
        : order.status === 'arrived'
          ? quoteMeta?.label ?? meta.label
          : meta.label.toLowerCase() !== progressTitle.toLowerCase()
            ? meta.label
            : null;

  const mechanicName = assignedMechanic?.full_name ?? order.mechanic_name ?? 'Montir MontirGo';
  const mechanicAvatar = assignedMechanic?.avatar_url ?? order.mechanic_avatar;
  const mechanicPhone = assignedMechanic?.phone_number ?? order.mechanic_phone;
  const vehicleParts = [
    assignedMechanic?.vehicle_label?.trim(),
    assignedMechanic?.vehicle_plate?.trim(),
  ].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <Surface variant="default" padding="lg" style={styles.heroCard}>
        <View style={styles.heroTop}>
          <Badge label={meta.shortLabel} tone={meta.tone} icon={meta.icon} size="sm" />
          <AppText variant="caption" tone="muted" style={theme.tabularNums}>
            {formatDateTime(order.created_at)}
          </AppText>
        </View>

        {quoteMeta ? (
          <View style={styles.quoteRow}>
            <Badge
              label={quoteMeta.shortLabel}
              tone={quoteMeta.tone}
              icon={quoteMeta.icon}
              size="sm"
            />
          </View>
        ) : null}

        <AppText variant="h2" style={styles.heroTitle}>
          {progressTitle}
        </AppText>
        {heroSub ? (
          <AppText variant="body" tone="secondary">
            {heroSub}
          </AppText>
        ) : null}

        {meta.step > 0 ? (
          <View style={styles.progress}>
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.segment,
                  index < meta.step && { backgroundColor: tonePalette.fg },
                ]}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.heroFooter}>
          <AppText variant="caption" tone="muted" style={theme.tabularNums}>
            #{order.id.slice(0, 8).toUpperCase()}
          </AppText>
          <View style={styles.amountAlign}>
            <AppText variant="caption" tone="muted">
              {order.price_amount != null ? 'Total tagihan' : 'Biaya panggil'}
            </AppText>
            <AppText variant="title" style={theme.tabularNums}>
              {formatIDR(order.price_amount ?? order.callout_fee_amount)}
            </AppText>
          </View>
        </View>
      </Surface>

      {order.status === 'on_the_way' ? (
        <ClientTripEntryCard onPress={onOpenTracking} />
      ) : null}

      {order.status === 'mechanic_assigned' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lihat dan konfirmasi montir"
          onPress={onOpenAssignment}
          style={({ pressed }) => [styles.assignmentCard, pressed && styles.pressed]}
        >
          <View style={styles.assignmentIcon}>
            <Ionicons name="person-add-outline" size={20} color={theme.colors.statusWarningFg} />
          </View>
          <View style={styles.flexCopy}>
            <AppText variant="overline" tone="warning">
              PERLU KEPUTUSANMU
            </AppText>
            <AppText variant="title">Konfirmasi montir</AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={2}>
              {mechanicName} ingin menangani pesananmu. Cek rating, kendaraan, dan bengkelnya.
            </AppText>
          </View>
          <View style={styles.assignmentAction}>
            <AppText variant="label" tone="warning">
              Lihat
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.statusWarningFg} />
          </View>
        </Pressable>
      ) : order.mechanic_id ? (
        <Surface variant="default" padding="md" style={styles.mechanicCard}>
          <Avatar name={mechanicName} uri={mechanicAvatar} size={46} />
          <View style={styles.flexCopy}>
            <AppText variant="overline" tone="muted">
              MONTIR DITUGASKAN
            </AppText>
            <AppText variant="title" numberOfLines={1}>
              {mechanicName}
            </AppText>
            {assignedMechanic?.workshop_name ? (
              <AppText variant="caption" tone="secondary" numberOfLines={1}>
                {assignedMechanic.workshop_name}
              </AppText>
            ) : null}
            {vehicleParts.length > 0 ? (
              <View style={styles.vehicleBadge}>
                <Ionicons name="car-outline" size={13} color={theme.colors.statusInfoFg} />
                <AppText variant="caption" tone="info" numberOfLines={1}>
                  {vehicleParts.join(' · ')}
                </AppText>
              </View>
            ) : null}
          </View>
          {mechanicPhone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hubungi montir lewat WhatsApp"
              onPress={onChatMechanic}
              style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
            >
              <Ionicons name="logo-whatsapp" size={20} color={theme.colors.whatsappFg} />
            </Pressable>
          ) : null}
        </Surface>
      ) : (
        <View style={styles.searchingCard}>
          <View style={styles.searchingIcon}>
            <Ionicons name="search-outline" size={18} color={theme.colors.statusWarningFg} />
          </View>
          <View style={styles.flexCopy}>
            <AppText variant="label" tone="warning">
              Mencari montir terdekat
            </AppText>
            <AppText variant="caption" tone="secondary">
              Kamu akan menerima notifikasi saat montir mengajukan diri.
            </AppText>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    gap: theme.spacing.md,
  },
  heroCard: {
    gap: theme.spacing.xs,
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  quoteRow: {
    marginTop: theme.spacing.xxs,
  },
  heroTitle: {
    marginTop: theme.spacing.xs,
  },
  progress: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderSubtle,
  },
  heroFooter: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  amountAlign: {
    alignItems: 'flex-end' as const,
  },
  assignmentCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
  },
  assignmentIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  assignmentAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xxs,
  },
  mechanicCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  flexCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  vehicleBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.statusInfoBg,
  },
  chatButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.whatsappBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  searchingCard: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
    padding: theme.spacing.md,
  },
  searchingIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: { opacity: 0.78 },
});
