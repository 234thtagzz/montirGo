import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, Space, Tabular, Type } from '@/constants/brand';

interface HomeSummaryProps {
  activeOrders: number;
  vehicles: number;
  onlineMechanics: number;
  onPressOrders: () => void;
}

/**
 * Ringkasan aktivitas client — panel yang sama perannya dengan kartu performa
 * di Beranda montir: satu permukaan, angka nyata, dan tautan ke rincian.
 */
export function HomeSummary({
  activeOrders,
  vehicles,
  onlineMechanics,
  onPressOrders,
}: HomeSummaryProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lihat pesanan saya"
      onPress={onPressOrders}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <View style={styles.dot} />
          <Text style={styles.label}>Ringkasan aktivitas</Text>
        </View>
        <View style={styles.link}>
          <Text style={styles.linkText}>Pesanan</Text>
          <Ionicons name="arrow-forward" size={14} color={Brand.primary} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat icon="pulse-outline" value={activeOrders} label="Pesanan aktif" />
        <View style={styles.divider} />
        <Stat icon="car-outline" value={vehicles} label="Kendaraan" />
        <View style={styles.divider} />
        <Stat icon="construct-outline" value={onlineMechanics} label="Montir online" />
      </View>
    </Pressable>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={15} color={Brand.textMuted} />
      </View>
      <Text style={[styles.statValue, Tabular]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: Space.md,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  pressed: { opacity: 0.9 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.primary },
  label: { ...Type.meta, color: Brand.textSecondary, fontWeight: '600' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkText: { ...Type.label, color: Brand.primary, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.lg,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
  },
  stat: { flex: 1, alignItems: 'center' },
  statIcon: { height: 18, justifyContent: 'center' },
  statValue: { ...Type.h2, color: Brand.text, marginTop: 2 },
  statLabel: { ...Type.meta, color: Brand.textMuted, marginTop: 1, fontSize: 10 },
  divider: { width: 1, height: 34, backgroundColor: Brand.divider },
});
