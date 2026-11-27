import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { AppText } from '@/components/ui/text';
import { getRiskMeta, type AiRiskLevel } from '@/features/service-request/ai';
import { getStatusMeta } from '@/features/service-request/status';
import { useAppTheme, useThemedStyles, type AppTheme, type SemanticTone } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface OrderBadge {
  label: string;
  tone?: SemanticTone;
  color?: string;
  background?: string;
  icon: IconName;
}

interface OrderCardProps {
  issue: string;
  status: string;
  createdAt: string;
  vehicle?: string | null;
  clientName?: string | null;
  address?: string | null;
  price?: number | null;
  /** Risiko dari analisis AI (ditampilkan sebagai baris meta). */
  aiRisk?: AiRiskLevel | null;
  /** Ganti chip status default (mis. "Request baru" di tab Request). */
  badge?: OrderBadge;
  onPress?: () => void;
  action?: {
    label: string;
    icon: IconName;
    variant?: ComponentProps<typeof Button>['variant'];
    loading?: boolean;
    disabled?: boolean;
    onPress: () => void;
  };
}

/** Kartu order bergaya "job ticket": rail status semantik di kiri, isi ringkas. */
export function OrderCard({
  issue,
  status,
  createdAt,
  vehicle,
  clientName,
  address,
  price,
  aiRisk,
  badge,
  onPress,
  action,
}: OrderCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const meta = getStatusMeta(status);
  const riskMeta = aiRisk ? getRiskMeta(aiRisk) : null;

  const chipTone: SemanticTone = badge?.tone ?? meta.tone;
  const chipFg = badge?.color ?? theme.tones[chipTone].fg;
  const chipLabel = badge?.label ?? meta.shortLabel;
  const chipIcon = badge?.icon ?? meta.icon;

  const body = (
    <View style={styles.inner}>
      <View style={styles.top}>
        <Badge label={chipLabel} tone={chipTone} icon={chipIcon} size="sm" />
        <AppText variant="caption" tone="muted" style={theme.tabularNums}>
          {formatDateTime(createdAt)}
        </AppText>
      </View>

      <AppText variant="title" style={styles.issue} numberOfLines={2}>
        {issue}
      </AppText>

      <View style={styles.metas}>
        {vehicle ? <MetaRow icon="car-outline" text={vehicle} /> : null}
        {clientName ? <MetaRow icon="person-outline" text={clientName} /> : null}
        {address ? <MetaRow icon="location-outline" text={address} /> : null}
        {riskMeta ? (
          <View style={styles.metaRow}>
            <Ionicons name="sparkles-outline" size={14} color={theme.tones[riskMeta.tone].fg} />
            <AppText
              variant="label"
              style={{ color: theme.tones[riskMeta.tone].fg }}
            >
              Analisis AI: {riskMeta.label.toLowerCase()}
            </AppText>
          </View>
        ) : null}
      </View>

      {price != null || onPress ? (
        <View style={styles.footer}>
          {price != null ? (
            <View style={styles.priceWrap}>
              <AppText variant="overline" tone="muted">
                BIAYA
              </AppText>
              <Money value={price} size="md" color={theme.colors.textPrimary} />
            </View>
          ) : (
            <AppText variant="caption" tone="muted">
              Buka detail order
            </AppText>
          )}
          {onPress ? (
            <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
          ) : null}
        </View>
      ) : null}

      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          variant={action.variant}
          size="cta"
          loading={action.loading}
          disabled={action.disabled}
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
    </View>
  );

  const cardStyle = [styles.card, { borderLeftColor: chipFg }];

  if (!onPress) {
    return <View style={cardStyle}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chipLabel}: ${issue}`}
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

function MetaRow({ icon, text }: { icon: IconName; text: string }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={14} color={theme.colors.textMuted} />
      <AppText variant="caption" tone="secondary" style={styles.metaText} numberOfLines={1}>
        {text}
      </AppText>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderLeftWidth: 3,
    overflow: 'hidden' as const,
    marginBottom: theme.spacing.md,
  },
  pressed: { opacity: 0.78 },
  inner: { padding: theme.spacing.lg },
  top: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  issue: {
    marginTop: theme.spacing.md,
  },
  metas: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  metaText: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  priceWrap: {
    gap: theme.spacing.xxs,
  },
  action: {
    marginTop: theme.spacing.lg,
  },
});
