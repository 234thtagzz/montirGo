import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  children: ReactNode;
}

/**
 * Kerangka layar auth bergaya Calm Utility (adaptif Light & Dark).
 */
export function AuthScreen({ title, subtitle, showBack = false, children }: AuthScreenProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + theme.spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { paddingTop: insets.top + theme.spacing.lg }]}>
            {showBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kembali"
                hitSlop={8}
                onPress={goBack}
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              >
                <Ionicons name="arrow-back" size={20} color={theme.colors.textPrimary} />
              </Pressable>
            ) : null}

            <View style={styles.brandRow}>
              <View style={styles.logo}>
                <Ionicons name="construct" size={22} color={theme.colors.actionEmergencyFg} />
              </View>
              <View style={styles.brandCopy}>
                <AppText variant="title">MontirGo</AppText>
                <AppText variant="caption" tone="secondary">
                  Montir terdekat, siap bantu kapan saja
                </AppText>
              </View>
            </View>

            <AppText variant="h1" style={styles.headline}>
              Kendaraan bermasalah? Montir datang ke lokasimu.
            </AppText>
          </View>

          <Surface variant="default" padding="lg" style={styles.card}>
            <AppText variant="h1">{title}</AppText>
            {subtitle ? (
              <AppText variant="body" tone="secondary" style={styles.subtitle}>
                {subtitle}
              </AppText>
            ) : null}
            <View style={styles.form}>{children}</View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: theme.spacing.md,
  },
  back: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  brandRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.actionEmergencyBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  brandCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  headline: {
    marginTop: theme.spacing.xs,
  },
  card: {
    marginHorizontal: theme.spacing.screenPadding,
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
  },
  form: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  pressed: { opacity: 0.75 },
});
