import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { SERVICE_CATEGORIES, type ServiceCategory } from '@/features/service-request/categories';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

const URGENT_KEYS = ['montir', 'aki', 'ban', 'derek', 'bensin'];

function CategoryRow({
  category,
  isLast,
  onPress,
}: {
  category: ServiceCategory;
  isLast?: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const tonePalette = theme.tones[category.tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={category.label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, isLast && styles.rowLast, pressed && styles.pressed]}
    >
      <View style={[styles.iconBox, { backgroundColor: tonePalette.bg }]}>
        <Ionicons name={category.icon} size={21} color={tonePalette.fg} />
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{category.label}</AppText>
        <AppText variant="caption" tone="secondary">
          {category.description}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export default function ServicesScreen() {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
        <Surface variant="default" padding="md" style={styles.note}>
          <View style={styles.noteIcon}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.statusInfoFg} />
          </View>
          <AppText variant="caption" tone="secondary" style={styles.flexCopy}>
            Setiap layanan membuka form permintaan 3 ketukan dengan Biaya Panggil Pasti yang transparan.
          </AppText>
        </Surface>

        <SectionLabel icon="alert-circle-outline" label="DARURAT DI LOKASI" />
        <Surface variant="default" padding="none" style={styles.group}>
          {urgent.map((category, index) => (
            <CategoryRow
              key={category.key}
              category={category}
              isLast={index === urgent.length - 1}
              onPress={() => open(category)}
            />
          ))}
        </Surface>

        <SectionLabel icon="build-outline" label="PERAWATAN & LAINNYA" />
        <Surface variant="default" padding="none" style={styles.group}>
          {others.map((category, index) => (
            <CategoryRow
              key={category.key}
              category={category}
              isLast={index === others.length - 1}
              onPress={() => open(category)}
            />
          ))}
        </Surface>

        <AppText variant="caption" tone="muted" style={styles.footnote}>
          Butuh bantuan di luar daftar ini? Pilih “Mogok / Mesin” dan jelaskan keluhanmu.
        </AppText>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ icon, label }: { icon: IconName; label: string }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.sectionRow}>
      <Ionicons name={icon} size={13} color={theme.colors.textMuted} />
      <AppText variant="overline" tone="muted">
        {label}
      </AppText>
      <View style={styles.sectionLine} />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xxxl,
  },
  note: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    alignItems: 'center' as const,
    marginTop: theme.spacing.xs,
  },
  noteIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  flexCopy: { flex: 1 },
  sectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
  },
  group: {
    overflow: 'hidden' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    minHeight: 68,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  pressed: { opacity: 0.78 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  footnote: {
    marginTop: theme.spacing.xl,
    textAlign: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
  },
});
