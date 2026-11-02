import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Gradient, Radius, Space } from '@/constants/brand';
import { LinearGradient } from 'expo-linear-gradient';

interface ClientTripEntryCardProps {
  onPress: () => void;
}

/**
 * Pintu masuk ke layar perjalanan client (gaya kartu yang sama dengan sisi
 * montir). Dipakai di detail pesanan agar client bisa membuka kembali peta
 * setelah melihat rincian order.
 */
export function ClientTripEntryCard({ onPress }: ClientTripEntryCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Buka peta perjalanan montir"
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
          <Ionicons name="navigate" size={20} color={Brand.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Perjalanan sedang berlangsung</Text>
          <Text style={styles.desc}>
            Buka peta untuk melihat posisi montir, rute, dan perkiraan tiba secara realtime.
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
