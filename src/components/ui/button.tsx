import {
  ActivityIndicator,
  Pressable,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export type ButtonVariant =
  | 'primary'
  | 'emergency'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dangerSubtle'
  | 'whatsapp'
  | 'ink'
  | 'volt';

export type ButtonSize = 'cta' | 'md' | 'compact';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Kompatibilitas mundur; setara dengan `size="compact"`. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

function resolveButtonPalette(theme: AppTheme, variant: ButtonVariant) {
  switch (variant) {
    case 'emergency':
    case 'volt':
      return {
        background: theme.colors.actionEmergencyBg,
        pressedBackground: theme.colors.actionEmergencyPressed,
        border: theme.colors.actionEmergencyBg,
        text: theme.colors.actionEmergencyFg,
        icon: theme.colors.actionEmergencyFg,
        spinner: theme.colors.actionEmergencyFg,
      };
    case 'secondary':
      return {
        background: theme.colors.actionSecondaryBg,
        pressedBackground: theme.colors.bgSurfaceSubtle,
        border: theme.colors.actionSecondaryBorder,
        text: theme.colors.actionSecondaryFg,
        icon: theme.colors.textSecondary,
        spinner: theme.colors.textSecondary,
      };
    case 'ghost':
      return {
        background: theme.colors.transparent,
        pressedBackground: theme.colors.bgSurfaceSubtle,
        border: theme.colors.borderDefault,
        text: theme.colors.textPrimary,
        icon: theme.colors.textSecondary,
        spinner: theme.colors.textPrimary,
      };
    case 'danger':
      return {
        background: theme.colors.actionDangerBg,
        pressedBackground: theme.colors.actionDangerBg,
        border: theme.colors.actionDangerBg,
        text: theme.colors.actionDangerFg,
        icon: theme.colors.actionDangerFg,
        spinner: theme.colors.actionDangerFg,
      };
    case 'dangerSubtle':
      return {
        background: theme.colors.actionDangerSubtleBg,
        pressedBackground: theme.colors.actionDangerSubtleBg,
        border: theme.colors.statusDangerBorder,
        text: theme.colors.actionDangerSubtleFg,
        icon: theme.colors.actionDangerSubtleFg,
        spinner: theme.colors.actionDangerSubtleFg,
      };
    case 'whatsapp':
      return {
        background: theme.colors.whatsappBg,
        pressedBackground: theme.colors.whatsappBg,
        border: theme.colors.whatsappBg,
        text: theme.colors.whatsappFg,
        icon: theme.colors.whatsappFg,
        spinner: theme.colors.whatsappFg,
      };
    case 'primary':
    case 'ink':
    default:
      return {
        background: theme.colors.actionPrimaryBg,
        pressedBackground: theme.colors.actionPrimaryPressed,
        border: theme.colors.actionPrimaryBg,
        text: theme.colors.actionPrimaryFg,
        icon: theme.colors.actionPrimaryFg,
        spinner: theme.colors.actionPrimaryFg,
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
}: ButtonProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const resolvedSize: ButtonSize = compact ? 'compact' : size;
  const palette = resolveButtonPalette(theme, variant);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        resolvedSize === 'cta' && styles.cta,
        resolvedSize === 'compact' && styles.compact,
        {
          backgroundColor: pressed && !isDisabled ? palette.pressedBackground : palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.spinner} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={resolvedSize === 'compact' ? 16 : 18}
              color={palette.icon}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              resolvedSize === 'cta' && styles.labelCta,
              resolvedSize === 'compact' && styles.labelCompact,
              { color: palette.text },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  base: {
    minHeight: theme.components.button.mdHeight,
    paddingHorizontal: theme.components.button.paddingHorizontal,
    borderRadius: theme.components.button.radius,
    borderCurve: theme.components.button.borderCurve,
    borderWidth: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
  },
  cta: {
    minHeight: theme.components.button.ctaHeight,
    borderRadius: theme.radii.lg,
  },
  compact: {
    minHeight: theme.components.button.compactHeight,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.sm,
  },
  label: {
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  labelCta: {
    fontSize: 16,
    lineHeight: 22,
  },
  labelCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
});
