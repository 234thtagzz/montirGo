import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter, useSegments, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Jika false, tombol kembali tidak ditampilkan (mis. layar root). */
  showBack?: boolean;
  /** Tujuan cadangan saat riwayat navigasi kosong (deep-link / cold start). */
  fallbackHref?: Href;
  right?: ReactNode;
}

/**
 * Header layar pendalaman dengan fallback route sadar-role (client / mechanic / auth)
 * ketika dibuka langsung melalui deep link.
 */
export function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  fallbackHref,
  right,
}: ScreenHeaderProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref) {
      router.replace(fallbackHref);
      return;
    }
    const group = segments[0];
    if (group === '(mechanic)') {
      router.replace('/(mechanic)/(tabs)');
      return;
    }
    if (group === '(auth)') {
      router.replace('/(auth)/login');
      return;
    }
    router.replace('/(client)/(tabs)');
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            hitSlop={4}
            onPress={handleBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={20} color={theme.colors.textPrimary} />
          </Pressable>
        ) : null}

        <View style={styles.titleBox}>
          <AppText variant="h2" tone="primary" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  header: {
    backgroundColor: theme.colors.bgCanvas,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  back: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.sm,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  titleBox: {
    flex: 1,
  },
  subtitle: {
    marginTop: theme.spacing.xxs,
  },
  right: {
    minWidth: theme.touchTarget.min,
    alignItems: 'flex-end' as const,
  },
  pressed: {
    opacity: 0.65,
  },
});
