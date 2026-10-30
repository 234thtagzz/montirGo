import { Alert, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { AuthField } from '@/features/auth/components/auth-field';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { getAuthErrorMessage, useAuth } from '@/features/auth/service';
import { Brand, Space } from '@/constants/brand';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Login Gagal', 'Email dan kata sandi wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await login({ email: email.trim().toLowerCase(), password });
      // Navigasi sesuai role asli dari database
      if (user.role === 'MONTIR') {
        router.replace('/(mechanic)/(tabs)');
      } else {
        router.replace('/(client)/(tabs)');
      }
    } catch (error) {
      Alert.alert('Login Gagal', getAuthErrorMessage(error, 'Email atau kata sandi salah.'));
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
        placeholder="nama@email.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <AuthField
        label="Kata sandi"
        icon="lock-closed-outline"
        placeholder="Masukkan kata sandi"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={handleLogin}
      />

      <Button
        label="Masuk"
        icon="log-in-outline"
        loading={loading}
        onPress={handleLogin}
        style={styles.submit}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Belum punya akun?</Text>
        <Link href="/(auth)/register" style={styles.link}>
          Daftar sekarang
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  submit: { marginTop: Space.xl },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Space.xxl,
    paddingTop: Space.lg,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
  },
  footerText: { fontSize: 12.5, color: Brand.textSecondary },
  link: { fontSize: 12.5, fontWeight: '700', color: Brand.primary },
});
