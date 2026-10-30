import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { SERVICE_CATEGORIES } from '@/features/service-request/categories';

export default function ServicesScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Semua Layanan" subtitle="Pilih layanan yang kamu butuhkan" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Setiap layanan akan membuka form permintaan dengan deskripsi awal yang bisa kamu ubah.
        </Text>

        {SERVICE_CATEGORIES.map((category) => (
          <Pressable
            key={category.key}
            accessibilityRole="button"
            accessibilityLabel={category.label}
            onPress={() => {
              if (category.route === 'vehicles') {
                router.push('/(client)/(tabs)/my-vehicles');
                return;
              }
              if (category.route === 'services') return;
              router.push({
                pathname: '/(client)/request/new',
                params: { category: category.key },
              });
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[styles.iconBox, { backgroundColor: category.background }]}>
              <Ionicons name={category.icon} size={22} color={category.color} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.label}>{category.label}</Text>
              <Text style={styles.description}>{category.description}</Text>
            </View>
            {category.route === 'services' ? null : (
              <Ionicons name="chevron-forward" size={18} color={Brand.textMuted} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  intro: {
    fontSize: 12.5,
    color: Brand.textSecondary,
    lineHeight: 18,
    marginBottom: Space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  pressed: { opacity: 0.7 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700', color: Brand.text },
  description: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
});
