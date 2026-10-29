import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Gradient, Radius, Space } from '@/constants/brand';
import { LinearGradient } from 'expo-linear-gradient';

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
        colors={Gradient.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={enroute ? 'navigate' : 'map-outline'} size={20} color={Brand.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>
            {enroute ? 'Perjalanan sedang berlangsung' : 'Siap berangkat ke lokasi client'}
          </Text>
          <Text style={styles.desc}>
            {enroute
              ? 'Lanjutkan navigasi realtime dan tekan "Sampai di Lokasi" saat tiba.'
              : 'Buka layar perjalanan untuk melihat rute, ETA, dan mulai berkendara.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Brand.white} />
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: '700', color: Brand.white },
  desc: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 3, lineHeight: 16 },
  pressed: { opacity: 0.85 },
});
