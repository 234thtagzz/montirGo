import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, Space } from '@/constants/brand';

interface TripTopBarProps {
  title: string;
  subtitle: string;
  estimated: boolean;
  onBack: () => void;
  onOpenMaps: () => void;
}

/** Kartu status mengambang di atas peta (gaya aplikasi transportasi). */
export function TripTopBar({ title, subtitle, estimated, onBack, onOpenMaps }: TripTopBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + Space.sm }]}>
      <View style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={Brand.text} />
        </Pressable>

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <View style={styles.liveDot} />
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka rute di Google Maps"
          onPress={onOpenMaps}
          style={({ pressed }) => [styles.routeButton, pressed && styles.pressed]}
        >
          <Ionicons name="navigate" size={18} color={Brand.white} />
        </Pressable>
      </View>

      {estimated ? (
        <View style={styles.estimateChip}>
          <Ionicons name="information-circle-outline" size={12} color={Brand.amber} />
          <Text style={styles.estimateText}>Rute estimasi — data lalu lintas belum tersedia</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    ...CardShadow,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6FA',
  },
  copy: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.green },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: Brand.text },
  subtitle: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  routeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
  },
  estimateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    marginTop: Space.sm,
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Brand.amberSoft,
  },
  estimateText: { fontSize: 10.5, fontWeight: '600', color: Brand.amber },
  pressed: { opacity: 0.75 },
});
