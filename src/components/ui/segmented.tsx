import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemedStyles, type AppTheme } from '@/theme';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `ink` untuk dipakai di atas permukaan gelap terbalik. */
  tone?: 'light' | 'ink';
  style?: ComponentProps<typeof View>['style'];
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'light',
  style,
}: SegmentedProps<T>) {
  const styles = useThemedStyles(createStyles);
  const darkSurface = tone === 'ink';

  return (
    <View style={[styles.wrap, darkSurface ? styles.wrapInk : styles.wrapLight, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.item,
              active && (darkSurface ? styles.itemActiveInk : styles.itemActiveLight),
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                darkSurface && styles.labelInk,
                active && (darkSurface ? styles.labelActiveInk : styles.labelActiveLight),
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    flexDirection: 'row' as const,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  wrapLight: {
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  wrapInk: {
    backgroundColor: theme.colors.bgInverse,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  item: {
    flex: 1,
    minHeight: theme.touchTarget.min,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderCurve: theme.components.card.borderCurve,
  },
  itemActiveLight: {
    backgroundColor: theme.colors.bgSurface,
    ...theme.elevation.card,
  },
  itemActiveInk: {
    backgroundColor: theme.colors.actionPrimaryBg,
  },
  label: {
    ...theme.typography.label,
    ...theme.tabularNums,
    color: theme.colors.textSecondary,
  },
  labelInk: {
    color: theme.colors.textInverseMuted,
  },
  labelActiveLight: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  labelActiveInk: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.actionPrimaryFg,
  },
  pressed: {
    opacity: 0.72,
  },
});
