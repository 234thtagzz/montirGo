import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
import { formatIDR } from '@/utils/format';

interface StatTilesProps {
  netToday: number;
  jobsToday: number;
  activeOrders: number;
  onPressEarnings?: () => void;
}

export function StatTiles({ netToday, jobsToday, activeOrders, onPressEarnings }: StatTilesProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lihat rincian pendapatan"
        onPress={onPressEarnings}
        style={({ pressed }) => [styles.earnings, pressed && styles.pressed]}
      >
        <View style={styles.earningsIcon}>
          <Ionicons name="wallet-outline" size={20} color={Brand.green} />
        </View>
        <View style={styles.earningsCopy}>
          <Text style={styles.earningsLabel}>Pendapatan bersih hari ini</Text>
          <Text style={styles.earningsValue} numberOfLines={1}>
            {formatIDR(netToday)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Brand.textMuted} />
      </Pressable>

      <View style={styles.tilesRow}>
        <Tile icon="construct-outline" value={String(jobsToday)} label="Job hari ini" />
        <Tile icon="receipt-outline" value={String(activeOrders)} label="Order aktif" />
      </View>
    </View>
  );
}

function Tile({ icon, value, label }: { icon: 'construct-outline' | 'receipt-outline'; value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={17} color={Brand.primary} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  earnings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  pressed: { opacity: 0.85 },
  earningsIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsCopy: { flex: 1 },
  earningsLabel: { fontSize: 11.5, color: Brand.textSecondary, fontWeight: '600' },
  earningsValue: { fontSize: 19, fontWeight: '700', color: Brand.text, marginTop: 2 },
  tilesRow: { flexDirection: 'row', gap: Space.md, marginTop: Space.md },
  tile: {
    flex: 1,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileValue: { fontSize: 17, fontWeight: '700', color: Brand.text, marginTop: Space.sm },
  tileLabel: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
});
