import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface TripTopBarProps {
  title: string;
  subtitle: string;
  estimated: boolean;
  /** false = rute memakai OSRM (tanpa data lalu lintas realtime). */
  trafficAware: boolean;
  onBack: () => void;
  /** Aksi utama di kanan: buka rute (montir) atau chat (client). */
  onAction: () => void;
  actionIcon?: IconName;
  actionLabel?: string;
  actionTone?: 'primary' | 'whatsapp';
  actionBackground?: string;
}

/** Kartu status mengambang di atas peta perjalanan. */
export function TripTopBar({
  title,
  subtitle,
  estimated,
  trafficAware,
  onBack,
  onAction,
  actionIcon = 'navigate',
  actionLabel = 'Buka rute di Google Maps',
  actionTone = 'primary',
  actionBackground,
}: TripTopBarProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const resolvedActionBg =
    actionBackground ??
    (actionTone === 'whatsapp' ? theme.colors.whatsappBg : theme.colors.actionPrimaryBg);
  const resolvedActionFg =
    actionTone === 'whatsapp' ? theme.colors.whatsappFg : theme.colors.actionPrimaryFg;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top + theme.spacing.sm }]}
    >
      <View style={[styles.card, theme.elevation.sheet]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
        </Pressable>

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <View style={styles.liveDot} />
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.title}>
              {title}
            </AppText>
          </View>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [
            styles.routeButton,
            { backgroundColor: resolvedActionBg },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name={actionIcon} size={18} color={resolvedActionFg} />
        </Pressable>
      </View>

      {estimated ? (
        <View style={styles.estimateChip}>
          <Ionicons name="information-circle-outline" size={14} color={theme.colors.statusWarningFg} />
          <AppText variant="caption" tone="warning">
            Rute estimasi — data lalu lintas belum tersedia
          </AppText>
        </View>
      ) : !trafficAware ? (
        <View style={styles.routeChip}>
          <Ionicons name="navigate" size={14} color={theme.colors.statusInfoFg} />
          <AppText variant="caption" tone="info">
            Rute tercepat · tanpa data lalu lintas
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  copy: { flex: 1, gap: theme.spacing.xxs },
  titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: theme.spacing.xs },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.statusSuccessFg,
  },
  title: { flex: 1 },
  routeButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.pill,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  estimateChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    alignSelf: 'center' as const,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
  },
  routeChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    alignSelf: 'center' as const,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.statusInfoBg,
    borderWidth: 1,
    borderColor: theme.colors.statusInfoBorder,
  },
  pressed: { opacity: 0.78 },
});
