import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
import { getStatusMeta } from '@/features/service-request/status';
import { getRiskMeta, type AiRiskLevel } from '@/features/service-request/ai';
import { formatDateTime, formatIDR } from '@/utils/format';

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
  action?: { label: string; icon: IconName; loading?: boolean; onPress: () => void };
}

/** Kartu order yang dipakai di dashboard, request masuk, dan order aktif. */
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
    <>
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
              AI: {riskMeta.label.toLowerCase()}
            </Text>
          </View>
        ) : null}
      </View>

      {price != null ? (
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Biaya</Text>
          <Text style={styles.price}>{formatIDR(price)}</Text>
        </View>
      ) : null}

      {action ? (
        <Button
          label={action.label}
          icon={action.icon}
          loading={action.loading}
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.card}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
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
    borderColor: Brand.divider,
    padding: Space.lg,
    marginBottom: Space.md,
  },
  pressed: { opacity: 0.75 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chipText: { fontSize: 10.5, fontWeight: '700' },
  date: { fontSize: 10.5, color: Brand.textMuted },
  issue: { fontSize: 13.5, fontWeight: '600', color: Brand.text, marginTop: Space.md, lineHeight: 19 },
  metas: { gap: 5, marginTop: Space.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, fontSize: 11.5, color: Brand.textSecondary },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.md,
  },
  priceLabel: { fontSize: 11, color: Brand.textMuted, fontWeight: '600' },
  price: { fontSize: 14, fontWeight: '700', color: Brand.primary },
  action: { marginTop: Space.lg },
});
