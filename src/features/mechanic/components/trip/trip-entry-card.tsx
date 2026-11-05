import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Gradient, Radius, Space, Type } from '@/constants/brand';

interface TripEntryCardProps {
  /** Status order yang sedang berada di fase perjalanan. */
  status: 'mechanic_assigned' | 'mechanic_accepted' | 'on_the_way';
  onPress: () => void;
}

/**
 * Pintu masuk ke layar perjalanan (trip mode). Dipakai di beranda montir dan
 * detail order agar montir tidak perlu mencari menu navigasi.
 */
export function TripEntryCard({ status, onPress }: TripEntryCardProps) {
  const enroute = status === 'on_the_way';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={enroute ? 'Lanjutkan perjalanan ke lokasi client' : 'Buka layar perjalanan'}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={Gradient.ink}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={enroute ? 'navigate' : 'map-outline'} size={20} color={Brand.ink} />
        </View>
        <View style={styles.copy}>
          <View style={styles.labelRow}>
            <View style={styles.liveDot} />
            <Text style={styles.label}>{enroute ? 'TRIP MODE · LIVE' : 'TRIP MODE'}</Text>
          </View>
          <Text style={styles.title}>
            {enroute ? 'Perjalanan sedang berlangsung' : 'Siap berangkat ke lokasi client'}
          </Text>
          <Text style={styles.desc} numberOfLines={2}>
            {enroute
              ? 'Lanjutkan navigasi realtime, lalu konfirmasi saat tiba.'
              : 'Buka rute, ETA, dan mulai perjalanan dari sini.'}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={Brand.inkMuted} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Space.md },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Brand.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.volt },
  label: { ...Type.micro, color: Brand.inkMuted, fontSize: 9, letterSpacing: 1 },
  title: { ...Type.bodyStrong, color: Brand.white, fontWeight: '700' },
  desc: { ...Type.meta, color: Brand.inkMuted, marginTop: 2, lineHeight: 15 },
  pressed: { opacity: 0.85 },
});
