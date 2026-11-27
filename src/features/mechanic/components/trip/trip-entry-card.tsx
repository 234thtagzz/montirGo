import { Pressable, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface TripEntryCardProps {
  /** Status order yang sedang berada di fase perjalanan. */
  status: 'mechanic_assigned' | 'mechanic_accepted' | 'on_the_way';
  onPress: () => void;
}

/**
 * Pintu masuk ke layar perjalanan (trip mode) dari beranda montir dan detail order.
 */
export function TripEntryCard({ status, onPress }: TripEntryCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const enroute = status === 'on_the_way';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={enroute ? 'Lanjutkan perjalanan ke lokasi client' : 'Buka layar perjalanan'}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <Surface variant="elevated" padding="lg" style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={enroute ? 'navigate' : 'map-outline'}
            size={22}
            color={theme.colors.actionPrimaryFg}
          />
        </View>
        <View style={styles.copy}>
          <Badge
            size="sm"
            dot={enroute}
            tone={enroute ? 'success' : 'info'}
            label={enroute ? 'TRIP MODE · LIVE' : 'TRIP MODE'}
          />
          <AppText variant="bodyStrong">
            {enroute ? 'Perjalanan sedang berlangsung' : 'Siap berangkat ke lokasi client'}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={2}>
            {enroute
              ? 'Lanjutkan navigasi realtime, lalu konfirmasi saat tiba.'
              : 'Buka rute, ETA, dan mulai perjalanan dari sini.'}
          </AppText>
        </View>
        <Ionicons
          name="arrow-forward"
          size={18}
          color={theme.colors.textSecondary}
        />
      </Surface>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    marginTop: theme.spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.statusInfoBorder,
    backgroundColor: theme.colors.statusInfoBg,
  },
  iconWrap: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.actionPrimaryBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
});
