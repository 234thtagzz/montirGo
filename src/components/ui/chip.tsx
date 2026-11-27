import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { useAppTheme, useThemedStyles, type AppTheme, type SemanticTone } from '@/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: SemanticTone;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Chip pilihan / quick-pick interaktif dengan target sentuh >= 48px.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  tone = 'info',
  disabled = false,
  style,
}: ChipProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const selectedTone = theme.tones[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected
          ? {
              backgroundColor: selectedTone.bg,
              borderColor: selectedTone.fg,
            }
          : styles.unselected,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={selected ? selectedTone.fg : theme.colors.textSecondary}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: selected ? selectedTone.fg : theme.colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  base: {
    minHeight: theme.components.chip.minHeight,
    paddingHorizontal: theme.components.chip.paddingHorizontal,
    borderRadius: theme.components.chip.radius,
    borderCurve: theme.components.chip.borderCurve,
    borderWidth: 1.5,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
  },
  unselected: {
    backgroundColor: theme.colors.bgSurface,
    borderColor: theme.colors.borderDefault,
  },
  label: {
    ...theme.typography.label,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.48,
  },
});
