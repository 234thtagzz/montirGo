import { Pressable, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import type { ServiceCategory } from '@/features/service-request/categories';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface ServiceGridProps {
  categories: ServiceCategory[];
  onPressCategory: (category: ServiceCategory) => void;
}

/**
 * Triase Visual 2x3: 6 kategori darurat berikon besar & target sentuh lapang
 * agar pengendara bisa langsung memilih jenis bantuan dalam 1 ketukan.
 */
export function ServiceGrid({ categories, onPressCategory }: ServiceGridProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.grid}>
      {categories.map((category) => {
        const tonePalette = theme.tones[category.tone];
        return (
          <Pressable
            key={category.key}
            accessibilityRole="button"
            accessibilityLabel={`${category.label}: ${category.description}`}
            onPress={() => onPressCategory(category)}
            style={({ pressed }) => [
              styles.card,
              theme.elevation.card,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: tonePalette.bg,
                  borderColor: tonePalette.border,
                },
              ]}
            >
              <Ionicons name={category.icon} size={22} color={tonePalette.fg} />
            </View>
            <AppText variant="label" numberOfLines={1}>
              {category.label}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={2}>
              {category.description}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  card: {
    width: '48.5%' as const,
    minHeight: 112,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.xxs,
  },
  pressed: { opacity: 0.78 },
});
