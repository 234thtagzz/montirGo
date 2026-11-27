import { useState } from 'react';
import { View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { AuthField } from '@/features/auth/components/auth-field';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { getAuthErrorMessage, useAuth } from '@/features/auth/service';
import { useThemedStyles, type AppTheme } from '@/theme';

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const emailError = !email.trim() ? 'Email wajib diisi.' : null;
  const passwordError = !password ? 'Kata sandi wajib diisi.' : null;

  const handleLogin = async () => {
    setSubmitted(true);
    if (emailError || passwordError) return;

    setLoading(true);
    try {
      const { user } = await login({ email: email.trim().toLowerCase(), password });
      if (user.role === 'ADMIN') {
        router.replace('/(auth)/admin-only');
      } else if (user.role === 'MONTIR') {
        router.replace('/(mechanic)/(tabs)');
      } else {
        router.replace('/(client)/(tabs)');
      }
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Login gagal',
        message: getAuthErrorMessage(error, 'Email atau kata sandi salah.'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Masuk ke akun"
      subtitle="Gunakan email dan kata sandi yang terdaftar untuk melanjutkan."
    >
      <AuthField
        label="Email"
        icon="mail-outline"
        required
        placeholder="nama@email.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        error={emailError}
        showError={submitted}
      />
      <AuthField
        label="Kata sandi"
        icon="lock-closed-outline"
        required
        placeholder="Masukkan kata sandi"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        error={passwordError}
        showError={submitted}
        onSubmitEditing={() => void handleLogin()}
      />

      <Button
        label="Masuk"
        icon="log-in-outline"
        size="cta"
        loading={loading}
        onPress={() => void handleLogin()}
      />

      <View style={styles.footer}>
        <AppText variant="body" tone="secondary">
          Belum punya akun?
        </AppText>
        <Link href="/(auth)/register" style={styles.link}>
          Daftar sekarang
        </Link>
      </View>
    </AuthScreen>
  );
}

const createStyles = (theme: AppTheme) => ({
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  link: {
    fontFamily: theme.fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.actionPrimaryAltBg,
  },
});
