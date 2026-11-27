import { Pressable, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface SectionHeaderProps {
  title: string;
  /** Label kecil di atas judul, mis. "ORDER". */
  eyebrow?: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SectionHeader({
  title,
  eyebrow,
  actionLabel,
  onPressAction,
}: SectionHeaderProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? (
          <AppText variant="overline" tone="muted" style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="h2" tone="primary">
          {title}
        </AppText>
      </View>
      {actionLabel && onPressAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          onPress={onPressAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <AppText variant="label" tone="info">
            {actionLabel}
          </AppText>
          <Ionicons name="arrow-forward" size={14} color={theme.colors.statusInfoFg} />
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.md,
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: theme.spacing.xxs,
  },
  action: {
    minHeight: theme.touchTarget.min,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  pressed: {
    opacity: 0.65,
  },
});
