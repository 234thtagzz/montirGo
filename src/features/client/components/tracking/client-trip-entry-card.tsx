import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';

interface ClientTripEntryCardProps {
  onPress: () => void;
}

/**
 * Pintu masuk ke layar perjalanan client. Permukaan ink dengan aksen volt
 * menandai bahwa ada sesuatu yang sedang berlangsung saat ini.
 */
export function ClientTripEntryCard({ onPress }: ClientTripEntryCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Buka peta perjalanan montir"
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={styles.rail} />
      <View style={styles.iconWrap}>
        <Ionicons name="navigate" size={19} color={Brand.volt} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>SEDANG BERLANGSUNG</Text>
        <Text style={styles.title}>Montir menuju lokasimu</Text>
        <Text style={styles.desc} numberOfLines={2}>
          Buka peta untuk melihat posisi, rute, dan perkiraan tiba secara realtime.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={Brand.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.ink,
    borderRadius: Radius.lg,
    padding: Space.lg,
    paddingLeft: Space.lg + 3,
    marginTop: Space.md,
    overflow: 'hidden',
  },
  rail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Brand.volt,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  eyebrow: { ...Type.micro, fontSize: 8.5, color: Brand.inkMuted },
  title: { ...Type.bodyStrong, fontWeight: '700', color: Brand.white, marginTop: 2 },
  desc: { fontSize: 11, color: Brand.inkText, marginTop: 2, lineHeight: 15 },
  pressed: { opacity: 0.9 },
});
