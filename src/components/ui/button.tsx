import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import { Ionicons, type IconName } from '@/components/ui/icon';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'volt' | 'ink' | 'danger';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Palet tombol mengikuti kartu Saldo MontirGo Pay:
 * gelap (ink) untuk aksi utama, terang (surface + border) untuk aksi
 * sekunder, dan volt hanya sebagai aksen di atas permukaan gelap.
 */
const VARIANTS: Record<
  ButtonVariant,
  { background: string; border: string; text: string; icon: string; spinner: string }
> = {
  primary: {
    background: Brand.ink,
    border: Brand.ink,
    text: Brand.white,
    icon: Brand.volt,
    spinner: Brand.volt,
  },
  secondary: {
    background: Brand.surface,
    border: Brand.border,
    text: Brand.text,
    icon: Brand.textSecondary,
    spinner: Brand.textSecondary,
  },
  ghost: {
    background: 'transparent',
    border: Brand.border,
    text: Brand.text,
    icon: Brand.textSecondary,
    spinner: Brand.text,
  },
  volt: {
    background: Brand.volt,
    border: Brand.volt,
    text: Brand.ink,
    icon: Brand.ink,
    spinner: Brand.ink,
  },
  ink: {
    background: Brand.ink,
    border: Brand.ink,
    text: Brand.white,
    icon: Brand.volt,
    spinner: Brand.volt,
  },
  danger: {
    background: Brand.redSoft,
    border: Brand.redSoft,
    text: Brand.red,
    icon: Brand.red,
    spinner: Brand.red,
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.86 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.spinner} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={compact ? 16 : 18} color={palette.icon} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[styles.label, compact && styles.labelCompact, { color: palette.text }]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  compact: { minHeight: 40, paddingHorizontal: Space.lg, borderRadius: Radius.sm },
  label: { ...Type.bodyStrong, fontWeight: '700', fontSize: 15 },
  labelCompact: { fontSize: 13 },
});
