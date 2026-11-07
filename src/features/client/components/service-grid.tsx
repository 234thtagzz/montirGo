import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import type { ServiceCategory } from '@/features/service-request/categories';

interface ServiceGridProps {
  categories: ServiceCategory[];
  onPressCategory: (category: ServiceCategory) => void;
}

/**
 * Katalog layanan. Warna per kategori dihilangkan: semua tile memakai satu
 * aksen biru agar grid tetap tenang dan konsisten dengan permukaan lain.
 */
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
          <View style={styles.iconBox}>
            <Ionicons name={category.icon} size={23} color={Brand.primary} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: {
    width: '25%',
    alignItems: 'center',
    marginBottom: Space.lg,
    paddingHorizontal: 2,
    minHeight: 84,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Type.meta,
    marginTop: Space.sm,
    fontWeight: '600',
    color: Brand.text,
    textAlign: 'center',
  },
  pressed: { opacity: 0.65 },
});
