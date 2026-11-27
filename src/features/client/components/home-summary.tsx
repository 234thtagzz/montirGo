import { Pressable, View } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface HomeSummaryProps {
  activeOrders: number;
  vehicles: number;
  onlineMechanics: number;
  onPressOrders: () => void;
}

/**
 * Ringkasan aktivitas client dalam satu kartu tenang dengan `tabular-nums`.
 */
export function HomeSummary({
  activeOrders,
  vehicles,
  onlineMechanics,
  onPressOrders,
}: HomeSummaryProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lihat pesanan saya"
      onPress={onPressOrders}
      style={({ pressed }) => [styles.card, theme.elevation.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.labelRow}>
          <View style={styles.dot} />
          <AppText variant="label" tone="secondary">
            Ringkasan aktivitas
          </AppText>
        </View>
        <View style={styles.link}>
          <AppText variant="label" tone="info">
            Pesanan
          </AppText>
          <Ionicons name="arrow-forward" size={14} color={theme.colors.statusInfoFg} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat icon="pulse-outline" value={activeOrders} label="Pesanan aktif" />
        <View style={styles.divider} />
        <Stat icon="car-outline" value={vehicles} label="Kendaraan" />
        <View style={styles.divider} />
        <Stat icon="construct-outline" value={onlineMechanics} label="Montir online" />
      </View>
    </Pressable>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={theme.colors.textMuted} />
      </View>
      <AppText variant="h2" style={theme.tabularNums}>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  pressed: { opacity: 0.85 },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  labelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.actionPrimaryAltBg,
  },
  link: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xxs,
  },
  statsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  stat: {
    flex: 1,
    alignItems: 'center' as const,
    gap: theme.spacing.xxs,
  },
  statIcon: {
    height: 18,
    justifyContent: 'center' as const,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.borderSubtle,
  },
});
