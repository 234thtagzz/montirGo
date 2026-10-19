import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Gradient, Radius, ScreenPadding, Space } from '@/constants/brand';

export type PromoKey = 'request' | 'track' | 'vehicle';

interface Promo {
  key: PromoKey;
  title: string;
  body: string;
  icon: IconName;
  colors: readonly [string, string];
}

const PROMOS: Promo[] = [
  {
    key: 'request',
    title: 'Pesan montir dalam 3 langkah',
    body: 'Pilih layanan, jelaskan keluhan, montir datang.',
    icon: 'flash-outline',
    colors: Gradient.promoBlue,
  },
  {
    key: 'track',
    title: 'Pantau pesanan secara langsung',
    body: 'Status montir diperbarui otomatis di aplikasi.',
    icon: 'navigate-outline',
    colors: Gradient.promoGreen,
  },
  {
    key: 'vehicle',
    title: 'Simpan kendaraanmu',
    body: 'Buat permintaan berikutnya jadi lebih cepat.',
    icon: 'car-sport-outline',
    colors: Gradient.promoAmber,
  },
];

interface PromoCarouselProps {
  onPressPromo: (key: PromoKey) => void;
}

export function PromoCarousel({ onPressPromo }: PromoCarouselProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - ScreenPadding * 2 - 28, 500);
  const gap = Space.md;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + gap}
      contentContainerStyle={{ gap }}
      style={styles.scroll}
    >
      {PROMOS.map((promo) => (
        <Pressable
          key={promo.key}
          accessibilityRole="button"
          accessibilityLabel={promo.title}
          onPress={() => onPressPromo(promo.key)}
          style={({ pressed }) => [{ width: cardWidth }, pressed && styles.pressed]}
        >
          <LinearGradient
            colors={promo.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.decorLarge} />
            <View style={styles.decorSmall} />
            <View style={styles.cardContent}>
              <View style={styles.iconCircle}>
                <Ionicons name={promo.icon} size={18} color={Brand.white} />
              </View>
              <Text style={styles.title}>{promo.title}</Text>
              <Text style={styles.body}>{promo.body}</Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>Lihat</Text>
                <Ionicons name="arrow-forward" size={13} color={Brand.white} />
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginTop: Space.xs },
  card: {
    height: 148,
    borderRadius: Radius.lg,
    padding: Space.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cardContent: { maxWidth: '78%' },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.sm,
  },
  title: { color: Brand.white, fontSize: 15, fontWeight: '700' },
  body: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Space.md },
  ctaText: { color: Brand.white, fontSize: 11.5, fontWeight: '700' },
  decorLarge: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  decorSmall: {
    position: 'absolute',
    right: 40,
    bottom: -50,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pressed: { opacity: 0.9 },
});
