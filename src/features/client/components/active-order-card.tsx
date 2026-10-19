import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, Space } from '@/constants/brand';
import { formatDateTime } from '@/utils/format';
import type { ClientOrder } from '@/features/client/types';
import { getProgressLabel, getStatusMeta } from '@/features/service-request/status';

interface ActiveOrderCardProps {
  order: ClientOrder;
  onPress: () => void;
}

export function ActiveOrderCard({ order, onPress }: ActiveOrderCardProps) {
  const meta = getStatusMeta(order.status);
  const hasMechanic = Boolean(order.mechanic_id);
  const vehicle = [order.vehicle_brand, order.vehicle_model].filter(Boolean).join(' ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pesanan aktif: ${getProgressLabel(order.status)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={[styles.chip, { backgroundColor: meta.background }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.chipText, { color: meta.color }]}>{meta.shortLabel}</Text>
        </View>
        <Text style={styles.time}>{formatDateTime(order.created_at)}</Text>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {getProgressLabel(order.status)}
      </Text>
      <Text style={styles.issue} numberOfLines={1}>
        {vehicle ? `${vehicle} • ` : ''}
        {order.issue_description}
      </Text>

      {meta.step > 0 ? (
        <View style={styles.progress}>
          {Array.from({ length: 7 }).map((_, index) => (
            <View
              key={index}
              style={[styles.segment, index < meta.step && styles.segmentActive]}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.mechanicRow}>
          {hasMechanic ? (
            <>
              <Avatar name={order.mechanic_name ?? 'Montir'} uri={order.mechanic_avatar} size={32} />
              <View style={styles.mechanicText}>
                <Text style={styles.mechanicName} numberOfLines={1}>
                  {order.mechanic_name ?? 'Montir MontirGo'}
                </Text>
                <Text style={styles.mechanicRole}>Montir</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.searching}>
                <ActivityIndicator size="small" color={Brand.primary} />
              </View>
              <Text style={styles.mechanicName}>Mencari montir terdekat…</Text>
            </>
          )}
        </View>

        <View style={styles.detailButton}>
          <Text style={styles.detailText}>Lacak</Text>
          <Ionicons name="chevron-forward" size={14} color={Brand.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    ...CardShadow,
  },
  pressed: { opacity: 0.94 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  chipText: { fontSize: 10.5, fontWeight: '700' },
  time: { fontSize: 11, color: Brand.textMuted },
  title: { fontSize: 15, fontWeight: '700', color: Brand.text, marginTop: Space.md },
  issue: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 4, marginTop: Space.md },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.divider,
  },
  segmentActive: { backgroundColor: Brand.primary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.lg,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
    paddingTop: Space.md,
  },
  mechanicRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flex: 1 },
  mechanicText: { flex: 1 },
  mechanicName: { fontSize: 12.5, fontWeight: '600', color: Brand.text },
  mechanicRole: { fontSize: 10.5, color: Brand.textMuted, marginTop: 1 },
  searching: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailText: { fontSize: 12.5, fontWeight: '700', color: Brand.primary },
});
