import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';

export type PromoKey = 'request' | 'track' | 'vehicle';

interface Promo {
  key: PromoKey;
  eyebrow: string;
  title: string;
  body: string;
  icon: IconName;
}

const PROMOS: Promo[] = [
  {
    key: 'request',
    eyebrow: 'MULAI CEPAT',
    title: 'Pesan montir dalam 3 langkah',
    body: 'Pilih layanan, jelaskan keluhan, montir datang.',
    icon: 'flash-outline',
  },
  {
    key: 'track',
    eyebrow: 'PELACAKAN',
    title: 'Pantau montir secara langsung',
    body: 'Status perjalanan diperbarui otomatis di aplikasi.',
    icon: 'navigate-outline',
  },
  {
    key: 'vehicle',
    eyebrow: 'GARASI',
    title: 'Simpan kendaraanmu',
    body: 'Permintaan berikutnya jadi lebih cepat dibuat.',
    icon: 'car-sport-outline',
  },
];

interface PromoCarouselProps {
  onPressPromo: (key: PromoKey) => void;
}

/**
 * Rel panduan horizontal. Memakai permukaan kartu yang sama dengan komponen
 * lain (surface + border) dan satu aksen biru, tanpa gradient atau aksen
 * dekoratif per kartu.
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
            <View style={styles.topRow}>
              <View style={styles.iconTile}>
                <Ionicons name={promo.icon} size={17} color={Brand.primary} />
              </View>
              <Text style={styles.eyebrow}>{promo.eyebrow}</Text>
            </View>
            <Text style={styles.title}>{promo.title}</Text>
            <Text style={styles.body} numberOfLines={2}>
              {promo.body}
            </Text>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Lihat</Text>
              <Ionicons name="arrow-forward" size={13} color={Brand.primary} />
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 146,
    borderRadius: Radius.lg,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.lg,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { ...Type.micro, color: Brand.primary, letterSpacing: 0.9 },
  title: { ...Type.title, color: Brand.text, marginTop: Space.md },
  body: { ...Type.meta, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Space.md },
  ctaText: { ...Type.label, color: Brand.primary, fontWeight: '700' },
  pressed: { opacity: 0.9 },
});
