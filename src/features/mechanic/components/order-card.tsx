import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import { getStatusMeta } from '@/features/service-request/status';
import { getRiskMeta, type AiRiskLevel } from '@/features/service-request/ai';
import { formatDateTime } from '@/utils/format';

interface OrderBadge {
  label: string;
  color: string;
  background: string;
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
    loading?: boolean;
    disabled?: boolean;
    onPress: () => void;
  };
}

/** Kartu order bergaya "job ticket": rail status di kiri, isi ringkas. */
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
  const meta = getStatusMeta(status);
  const riskMeta = aiRisk ? getRiskMeta(aiRisk) : null;
  const chip = badge ?? {
    label: meta.shortLabel,
    color: meta.color,
    background: meta.background,
    icon: meta.icon,
  };

  const body = (
    <View style={styles.inner}>
      <View style={styles.top}>
        <View style={[styles.chip, { backgroundColor: chip.background }]}>
          <Ionicons name={chip.icon} size={12} color={chip.color} />
          <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
        </View>
        <Text style={styles.date}>{formatDateTime(createdAt)}</Text>
      </View>

      <Text style={styles.issue} numberOfLines={2}>
        {issue}
      </Text>

      <View style={styles.metas}>
        {vehicle ? <MetaRow icon="car-outline" text={vehicle} /> : null}
        {clientName ? <MetaRow icon="person-outline" text={clientName} /> : null}
        {address ? <MetaRow icon="location-outline" text={address} /> : null}
        {riskMeta ? (
          <View style={styles.metaRow}>
            <Ionicons name="sparkles-outline" size={13} color={riskMeta.color} />
            <Text style={[styles.metaText, { color: riskMeta.color, fontWeight: '600' }]}>
              Analisis AI: {riskMeta.label.toLowerCase()}
            </Text>
          </View>
        ) : null}
      </View>

      {price != null || onPress ? (
        <View style={styles.footer}>
          {price != null ? (
            <View>
              <Text style={styles.priceLabel}>BIAYA</Text>
              <Money value={price} size="md" color={Brand.text} />
            </View>
          ) : (
            <Text style={styles.footerHint}>Buka detail order</Text>
          )}
          {onPress ? (
            <Ionicons name="arrow-forward" size={16} color={Brand.textMuted} />
          ) : null}
        </View>
      ) : null}

      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          loading={action.loading}
          disabled={action.disabled}
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
    </View>
  );

  const cardStyle = [styles.card, { borderLeftColor: chip.color }];

  if (!onPress) {
    return <View style={cardStyle}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${chip.label}: ${issue}`}
      onPress={onPress}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

function MetaRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={13} color={Brand.textMuted} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    borderLeftWidth: 3,
    overflow: 'hidden',
    marginBottom: Space.md,
  },
  pressed: { opacity: 0.78 },
  inner: { padding: Space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chipText: { ...Type.micro, fontSize: 9.5, letterSpacing: 0.2 },
  date: { ...Type.meta, color: Brand.textMuted },
  issue: { ...Type.bodyStrong, color: Brand.text, marginTop: Space.md, lineHeight: 20 },
  metas: { gap: 5, marginTop: Space.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, ...Type.meta, color: Brand.textSecondary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
  },
  priceLabel: { ...Type.micro, color: Brand.textMuted, marginBottom: 1 },
  footerHint: { ...Type.meta, color: Brand.textMuted },
  action: { marginTop: Space.lg },
});
