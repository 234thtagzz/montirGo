import { Pressable, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface ClientTripEntryCardProps {
  onPress: () => void;
}

/**
 * Pintu masuk ke layar perjalanan client saat montir `on_the_way`.
 */
export function ClientTripEntryCard({ onPress }: ClientTripEntryCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Buka peta perjalanan montir"
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, theme.elevation.card, pressed && styles.pressed]}
    >
      <View style={styles.rail} />
      <View style={styles.iconWrap}>
        <Ionicons name="navigate" size={20} color={theme.colors.statusInfoFg} />
      </View>
      <View style={styles.copy}>
        <AppText variant="overline" tone="info">
          SEDANG BERLANGSUNG
        </AppText>
        <AppText variant="title">Montir menuju lokasimu</AppText>
        <AppText variant="caption" tone="secondary" numberOfLines={2}>
          Buka peta untuk melihat posisi, rute, dan perkiraan tiba secara realtime.
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.statusInfoBorder,
    padding: theme.spacing.lg,
    paddingLeft: theme.spacing.lg + 4,
    overflow: 'hidden' as const,
  },
  rail: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: theme.colors.actionPrimaryAltBg,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  pressed: { opacity: 0.85 },
});
