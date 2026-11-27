import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { useAppTheme, useThemedStyles, type AppTheme, type SemanticTone } from '@/theme';

export interface BadgeProps {
  label: string;
  tone?: SemanticTone;
  icon?: IconName;
  dot?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/**
 * Lencana / pil status semantik dengan kontras terverifikasi WCAG AA
 * dan ukuran huruf minimum 11px.
 */
export function Badge({
  label,
  tone = 'neutral',
  icon,
  dot = false,
  size = 'md',
  style,
}: BadgeProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const palette = theme.tones[tone];

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 12 : 14} color={palette.fg} /> : null}
      <Text
        numberOfLines={1}
        style={[
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: palette.fg },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export { Badge as StatusPill };

const createStyles = (theme: AppTheme) => ({
  base: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    borderRadius: theme.components.badge.radius,
    borderCurve: theme.components.badge.borderCurve,
    borderWidth: 1,
    gap: theme.spacing.xs,
  },
  sm: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
  },
  md: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  textSm: {
    ...theme.typography.overline,
    letterSpacing: 0.2,
  },
  textMd: {
    ...theme.typography.caption,
    fontFamily: theme.fontFamily.bold,
  },
});
