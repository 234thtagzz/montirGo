import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { Brand, Radius, Space, Type } from '@/constants/brand';

interface StatTilesProps {
  netToday: number;
  jobsToday: number;
  activeOrders: number;
  onPressEarnings?: () => void;
}

/**
 * Ringkasan performa harian. Satu panel dengan hierarki jelas:
 * pendapatan adalah fokus, jumlah job & order menjadi konteks.
 */
export function StatTiles({ netToday, jobsToday, activeOrders, onPressEarnings }: StatTilesProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lihat rincian pendapatan"
      onPress={onPressEarnings}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <View style={styles.dot} />
          <Text style={styles.label}>Pendapatan bersih hari ini</Text>
        </View>
        <Ionicons name="arrow-forward" size={15} color={Brand.textMuted} />
      </View>

      <Money value={netToday} size="lg" color={Brand.text} style={styles.amount} />

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="construct-outline" size={14} color={Brand.textMuted} />
          <Text style={styles.metaValue}>{jobsToday}</Text>
          <Text style={styles.metaLabel}>job selesai</Text>
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <Ionicons name="pulse-outline" size={14} color={Brand.textMuted} />
          <Text style={styles.metaValue}>{activeOrders}</Text>
          <Text style={styles.metaLabel}>order aktif</Text>
        </View>
        <Text style={styles.metaFootnote}>Diperbarui otomatis</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  pressed: { opacity: 0.85 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.green },
  label: { ...Type.meta, color: Brand.textSecondary, fontWeight: '600' },
  amount: { marginTop: Space.sm },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.lg,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDivider: { width: 1, height: 16, backgroundColor: Brand.divider, marginHorizontal: Space.md },
  metaValue: { ...Type.bodyStrong, color: Brand.text, fontWeight: '700' },
  metaLabel: { ...Type.meta, color: Brand.textMuted },
  metaFootnote: { flex: 1, textAlign: 'right', ...Type.micro, color: Brand.textMuted, fontSize: 9 },
});
