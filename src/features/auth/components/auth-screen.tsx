import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Gradient, Radius, ScreenPadding, Space } from '@/constants/brand';

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  /** Tampilkan tombol kembali di atas hero (mis. layar daftar). */
  showBack?: boolean;
  children: ReactNode;
}

/**
 * Kerangka layar auth yang konsisten dengan section client:
 * hero gradient biru + kartu putih yang sedikit menumpuk ke atas.
 */
export function AuthScreen({ title, subtitle, showBack = false, children }: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Space.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={Gradient.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + Space.md }]}
          >
            <View style={styles.glowLarge} />
            <View style={styles.glowSmall} />

            {showBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kembali"
                hitSlop={8}
                onPress={goBack}
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              >
                <Ionicons name="arrow-back" size={19} color={Brand.white} />
              </Pressable>
            ) : null}

            <View style={styles.brandRow}>
              <View style={styles.logo}>
                <Ionicons name="construct" size={23} color={Brand.primary} />
              </View>
              <View>
                <Text style={styles.brandName}>MontirGo</Text>
                <Text style={styles.brandTag}>Montir terdekat, siap bantu</Text>
              </View>
            </View>

            <Text style={styles.headline}>Kendaraan bermasalah?{'\n'}Montir datang ke lokasimu.</Text>
            <Text style={styles.tagline}>
              Masuk atau daftar untuk memesan bantuan montir dan melacak pesananmu.
            </Text>
          </LinearGradient>

          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <View style={styles.form}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    paddingHorizontal: ScreenPadding,
    paddingBottom: 78,
    overflow: 'hidden',
  },
  glowLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -70,
    right: -60,
  },
  glowSmall: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: 10,
    left: -40,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: Brand.white, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  brandTag: { color: 'rgba(255,255,255,0.76)', fontSize: 11.5, marginTop: 1 },
  headline: {
    color: Brand.white,
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.3,
    marginTop: Space.xl,
  },
  tagline: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: Space.sm,
    maxWidth: 320,
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.xl,
    padding: Space.xl,
    marginHorizontal: ScreenPadding,
    marginTop: -56,
    ...CardShadow,
  },
  title: { fontSize: 20, fontWeight: '700', color: Brand.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 12.5, color: Brand.textSecondary, marginTop: 4, lineHeight: 18 },
  form: { marginTop: Space.lg },
  pressed: { opacity: 0.7 },
});
