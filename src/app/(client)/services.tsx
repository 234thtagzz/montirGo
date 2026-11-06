import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { SERVICE_CATEGORIES, type ServiceCategory } from '@/features/service-request/categories';

const URGENT_KEYS = ['montir', 'aki', 'ban', 'derek', 'bensin'];

function CategoryRow({
  category,
  onPress,
}: {
  category: ServiceCategory;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={category.label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconBox, { backgroundColor: category.background }]}>
        <Ionicons name={category.icon} size={21} color={category.color} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{category.label}</Text>
        <Text style={styles.description}>{category.description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={Brand.textMuted} />
    </Pressable>
  );
}

export default function ServicesScreen() {
  const router = useRouter();

  const open = (category: ServiceCategory) => {
    if (category.route === 'vehicles') {
      router.push('/(client)/(tabs)/my-vehicles');
      return;
    }
    if (category.route === 'services') return;
    router.push({
      pathname: '/(client)/request/new',
      params: { category: category.key },
    });
  };

  const urgent = SERVICE_CATEGORIES.filter((category) => URGENT_KEYS.includes(category.key));
  const others = SERVICE_CATEGORIES.filter(
    (category) => !URGENT_KEYS.includes(category.key) && category.route !== 'services',
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Layanan" subtitle="Pilih bantuan yang kamu butuhkan" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.note}>
          <View style={styles.noteIcon}>
            <Ionicons name="information-circle-outline" size={16} color={Brand.primary} />
          </View>
          <Text style={styles.noteText}>
            Setiap layanan membuka form permintaan dengan deskripsi awal yang bisa kamu ubah.
          </Text>
        </View>

        <SectionLabel icon="alert-circle-outline" label="DARURAT DI LOKASI" />
        <View style={styles.group}>
          {urgent.map((category) => (
            <CategoryRow
              key={category.key}
              category={category}
              onPress={() => open(category)}
            />
          ))}
        </View>

        <SectionLabel icon="build-outline" label="PERAWATAN & LAINNYA" />
        <View style={styles.group}>
          {others.map((category) => (
            <CategoryRow
              key={category.key}
              category={category}
              onPress={() => open(category)}
            />
          ))}
        </View>

        <Text style={styles.footnote}>
          Butuh bantuan di luar daftar ini? Pilih “Butuh Montir” dan jelaskan keluhanmu.
        </Text>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.sectionRow}>
      <Ionicons name={icon} size={12} color={Brand.textMuted} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { paddingHorizontal: ScreenPadding, paddingBottom: Space.xxxl },
  note: {
    flexDirection: 'row',
    gap: Space.sm,
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.md,
    marginTop: Space.xs,
  },
  noteIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.xs,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteText: { flex: 1, fontSize: 11.5, color: Brand.textSecondary, lineHeight: 16 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Space.xl,
    marginBottom: Space.sm,
  },
  sectionLabel: { ...Type.micro, color: Brand.textMuted, letterSpacing: 0.9 },
  group: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
    minHeight: 66,
  },
  pressed: { opacity: 0.7 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  label: { ...Type.bodyStrong, color: Brand.text },
  description: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2, lineHeight: 16 },
  footnote: {
    ...Type.meta,
    color: Brand.textMuted,
    lineHeight: 17,
    marginTop: Space.xl,
    textAlign: 'center',
    paddingHorizontal: Space.lg,
  },
});
