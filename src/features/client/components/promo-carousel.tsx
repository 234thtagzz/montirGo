import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';

export type PromoKey = 'request' | 'track' | 'vehicle';

interface Promo {
  key: PromoKey;
  eyebrow: string;
  title: string;
  body: string;
  icon: IconName;
  accent: string;
}

const PROMOS: Promo[] = [
  {
    key: 'request',
    eyebrow: 'MULAI CEPAT',
    title: 'Pesan montir dalam 3 langkah',
    body: 'Pilih layanan, jelaskan keluhan, montir datang.',
    icon: 'flash-outline',
    accent: Brand.primary,
  },
  {
    key: 'track',
    eyebrow: 'PELACAKAN',
    title: 'Pantau montir secara langsung',
    body: 'Status perjalanan diperbarui otomatis di aplikasi.',
    icon: 'navigate-outline',
    accent: Brand.volt,
  },
  {
    key: 'vehicle',
    eyebrow: 'GARASI',
    title: 'Simpan kendaraanmu',
    body: 'Permintaan berikutnya jadi lebih cepat dibuat.',
    icon: 'car-sport-outline',
    accent: '#F2B84B',
  },
];

interface PromoCarouselProps {
  onPressPromo: (key: PromoKey) => void;
}

/**
 * Rel info horizontal. Sengaja memakai satu permukaan ink yang konsisten
 * dengan aksen tipis per kartu, bukan tiga gradient berbeda dengan lingkaran
 * dekoratif.
 */
export function PromoCarousel({ onPressPromo }: PromoCarouselProps) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - ScreenPadding * 2 - 32, 460);
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
          <View style={styles.card}>
            <View style={[styles.accent, { backgroundColor: promo.accent }]} />
            <View style={styles.content}>
              <View style={styles.topRow}>
                <View style={styles.iconTile}>
                  <Ionicons name={promo.icon} size={17} color={promo.accent} />
                </View>
                <Text style={styles.eyebrow}>{promo.eyebrow}</Text>
              </View>
              <Text style={styles.title}>{promo.title}</Text>
              <Text style={styles.body} numberOfLines={2}>
                {promo.body}
              </Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>Lihat</Text>
                <Ionicons name="arrow-forward" size={13} color={Brand.inkText} />
              </View>
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginTop: Space.xs },
  card: {
    minHeight: 150,
    borderRadius: Radius.lg,
    backgroundColor: Brand.ink,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  accent: { width: 3 },
  content: { flex: 1, padding: Space.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: Radius.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: Brand.inkMuted,
  },
  title: {
    color: Brand.white,
    fontSize: 15,
    fontWeight: '700',
    marginTop: Space.md,
    letterSpacing: -0.2,
  },
  body: {
    color: Brand.inkMuted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Space.md },
  ctaText: { color: Brand.inkText, fontSize: 11.5, fontWeight: '700' },
  pressed: { opacity: 0.92 },
});
