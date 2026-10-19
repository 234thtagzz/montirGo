import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
import type { ServiceCategory } from '@/features/service-request/categories';

interface ServiceGridProps {
  categories: ServiceCategory[];
  onPressCategory: (category: ServiceCategory) => void;
}

export function ServiceGrid({ categories, onPressCategory }: ServiceGridProps) {
  return (
    <View style={styles.grid}>
      {categories.map((category) => (
        <Pressable
          key={category.key}
          accessibilityRole="button"
          accessibilityLabel={category.label}
          onPress={() => onPressCategory(category)}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <View style={[styles.iconBox, { backgroundColor: category.background }]}>
            <Ionicons name={category.icon} size={25} color={category.color} />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {category.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: Space.lg },
  item: {
    width: '25%',
    alignItems: 'center',
    marginBottom: Space.lg,
    paddingHorizontal: 2,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: Space.sm,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    color: Brand.text,
    textAlign: 'center',
  },
  pressed: { opacity: 0.65 },
});
