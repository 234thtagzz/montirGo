import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

type SurfaceVariant = 'default' | 'subtle' | 'elevated' | 'outlined' | 'inverse';
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';
type SurfaceRadius = 'sm' | 'md' | 'lg';

export interface SurfaceProps extends ViewProps {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
  style?: StyleProp<ViewStyle>;
}

/**
 * Kontainer permukaan dasar berbasis token semantik Calm Utility.
 */
export function Surface({
  variant = 'default',
  padding = 'md',
  radius = 'lg',
  style,
  children,
  ...rest
}: SurfaceProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[
        styles.base,
        variant === 'default' && styles.default,
        variant === 'subtle' && styles.subtle,
        variant === 'elevated' && [styles.elevated, theme.elevation.card],
        variant === 'outlined' && styles.outlined,
        variant === 'inverse' && styles.inverse,
        padding === 'none' && styles.padNone,
        padding === 'sm' && styles.padSm,
        padding === 'md' && styles.padMd,
        padding === 'lg' && styles.padLg,
        radius === 'sm' && styles.radSm,
        radius === 'md' && styles.radMd,
        radius === 'lg' && styles.radLg,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

/** Preset kartu standar dengan padding `lg` dan radius `lg` (16px). */
export function Card({
  variant = 'default',
  padding = 'lg',
  radius = 'lg',
  ...rest
}: SurfaceProps) {
  return <Surface variant={variant} padding={padding} radius={radius} {...rest} />;
}

const createStyles = (theme: AppTheme) => ({
  base: {
    borderCurve: 'continuous' as const,
  },
  default: {
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  subtle: {
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  elevated: {
    backgroundColor: theme.colors.bgSurfaceElevated,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  outlined: {
    backgroundColor: theme.colors.transparent,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  inverse: {
    backgroundColor: theme.colors.bgInverse,
    borderWidth: 0,
  },
  padNone: { padding: theme.spacing.none },
  padSm: { padding: theme.spacing.sm },
  padMd: { padding: theme.spacing.md },
  padLg: { padding: theme.spacing.lg },
  radSm: { borderRadius: theme.radii.sm },
  radMd: { borderRadius: theme.radii.md },
  radLg: { borderRadius: theme.radii.lg },
});
