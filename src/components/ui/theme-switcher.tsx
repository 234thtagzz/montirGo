import { View } from 'react-native';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme, type ThemePreference } from '@/theme';

const OPTIONS: SegmentedOption<ThemePreference>[] = [
  { value: 'system', label: 'Ikuti Sistem' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
];

export function ThemeSwitcher() {
  const { preference, setPreference } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <AppText variant="caption" tone="secondary">
        Tampilan aplikasi
      </AppText>
      <Segmented options={OPTIONS} value={preference} onChange={setPreference} />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    gap: theme.spacing.sm,
  },
});
