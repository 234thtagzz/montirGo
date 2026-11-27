import { Pressable, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface StatTilesProps {
  netToday: number;
  jobsToday: number;
  activeOrders: number;
  onPressEarnings?: () => void;
}

/**
 * Ringkasan performa harian montir di Beranda.
 */
export function StatTiles({ netToday, jobsToday, activeOrders, onPressEarnings }: StatTilesProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lihat rincian pendapatan"
      onPress={onPressEarnings}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Surface variant="default" padding="lg">
        <View style={styles.topRow}>
          <View style={styles.labelRow}>
            <View style={styles.dot} />
            <AppText variant="label" tone="secondary">
              Pendapatan bersih hari ini
            </AppText>
          </View>
          <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
        </View>

        <Money
          value={netToday}
          size="lg"
          color={theme.colors.textPrimary}
          style={styles.amount}
        />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="construct-outline" size={14} color={theme.colors.textMuted} />
            <AppText variant="bodyStrong" tabular>
              {jobsToday}
            </AppText>
            <AppText variant="caption" tone="muted">
              job selesai
            </AppText>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="pulse-outline" size={14} color={theme.colors.textMuted} />
            <AppText variant="bodyStrong" tabular>
              {activeOrders}
            </AppText>
            <AppText variant="caption" tone="muted">
              order aktif
            </AppText>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  pressed: {
    opacity: 0.85,
  },
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
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.statusSuccessFg,
  },
  amount: {
    marginTop: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    gap: theme.spacing.md,
  },
  metaItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  metaDivider: {
    width: 1,
    height: 16,
    backgroundColor: theme.colors.borderSubtle,
  },
});
