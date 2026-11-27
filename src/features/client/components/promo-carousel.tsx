import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

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
    title: 'Pesan montir dalam 3 ketukan',
    body: 'Pilih masalah, pastikan lokasi, lihat biaya panggil pasti, kirim.',
    icon: 'flash-outline',
  },
  {
    key: 'track',
    eyebrow: 'PELACAKAN',
    title: 'Pantau montir secara langsung',
    body: 'Posisi montir dan persetujuan estimasi transparan di aplikasi.',
    icon: 'navigate-outline',
  },
  {
    key: 'vehicle',
    eyebrow: 'GARASI',
    title: 'Simpan kendaraanmu',
    body: 'Tier motor/mobil terisi otomatis pada permintaan berikutnya.',
    icon: 'car-sport-outline',
  },
];

interface PromoCarouselProps {
  onPressPromo: (key: PromoKey) => void;
}

export function PromoCarousel({ onPressPromo }: PromoCarouselProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - theme.spacing.screenPadding * 2 - 32, 460);
  const gap = theme.spacing.md;

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
          <View style={[styles.card, theme.elevation.card]}>
            <View style={styles.topRow}>
              <View style={styles.iconTile}>
                <Ionicons name={promo.icon} size={17} color={theme.colors.statusInfoFg} />
              </View>
              <AppText variant="overline" tone="info">
                {promo.eyebrow}
              </AppText>
            </View>
            <AppText variant="title" style={styles.title}>
              {promo.title}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={2}>
              {promo.body}
            </AppText>
            <View style={styles.cta}>
              <AppText variant="label" tone="info">
                Lihat
              </AppText>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.statusInfoFg} />
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    minHeight: 150,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    marginTop: theme.spacing.xs,
  },
  cta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  pressed: { opacity: 0.85 },
});
