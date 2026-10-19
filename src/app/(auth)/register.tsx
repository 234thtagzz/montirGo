import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AuthField } from '@/features/auth/components/auth-field';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { getAuthErrorMessage, useAuth, type UserRole } from '@/features/auth/service';
import { Brand, Radius, Space } from '@/constants/brand';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: {
  key: UserRole;
  title: string;
  description: string;
  icon: IconName;
}[] = [
  {
    key: 'CLIENT',
    title: 'Client',
    description: 'Butuh bantuan montir',
    icon: 'car-sport-outline',
  },
  {
    key: 'MONTIR',
    title: 'Montir',
    description: 'Tawarkan jasa bantuan',
    icon: 'construct-outline',
  },
];

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole: UserRole =
    typeof params.role === 'string' && params.role.toUpperCase() === 'MONTIR' ? 'MONTIR' : 'CLIENT';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Gagal', 'Nama lengkap wajib diisi.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert('Gagal', 'Email tidak valid.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Gagal', 'Kata sandi minimal 6 karakter.');
      return;
    }
    setLoading(true);
    try {
      // Tersimpan ke Supabase Auth + tabel profiles (via trigger handle_new_user).
      const { user, needsConfirmation } = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        role,
      });
      if (needsConfirmation || !user) {
        Alert.alert(
          'Cek Email',
          'Akun dibuat. Verifikasi email kamu terlebih dahulu, lalu silakan login.',
        );
      } else {
        Alert.alert(
          'Berhasil',
          `Akun ${user.role === 'MONTIR' ? 'Montir' : 'Client'} berhasil dibuat. Silakan login.`,
        );
      }
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('Gagal', getAuthErrorMessage(error, 'Terjadi kesalahan saat pendaftaran.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      showBack
      title="Buat akun baru"
      subtitle="Pilih peranmu, lalu lengkapi data untuk mulai menggunakan MontirGo."
    >
      <Text style={styles.label}>Daftar sebagai</Text>
      <View style={styles.roleRow}>
        {ROLE_OPTIONS.map((option) => {
          const active = role === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Daftar sebagai ${option.title}`}
              onPress={() => setRole(option.key)}
              style={({ pressed }) => [
                styles.roleCard,
                active && styles.roleCardActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.roleIcon, active && styles.roleIconActive]}>
                <Ionicons
                  name={option.icon}
                  size={18}
                  color={active ? Brand.primary : Brand.textSecondary}
                />
              </View>
              {active ? (
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={Brand.primary}
                  style={styles.roleCheck}
                />
              ) : null}
              <Text style={[styles.roleTitle, active && styles.roleTitleActive]}>
                {option.title}
              </Text>
              <Text style={styles.roleDescription}>{option.description}</Text>
            </Pressable>
          );
        })}
      </View>

      <AuthField
        label="Nama lengkap"
        icon="person-outline"
        placeholder="Contoh: Budi Santoso"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
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
        label="Nomor telepon (opsional)"
        icon="call-outline"
        placeholder="08xx xxxx xxxx"
        value={phone}
        onChangeText={setPhone}
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        returnKeyType="next"
      />
      <AuthField
        label="Kata sandi"
        icon="lock-closed-outline"
        placeholder="Minimal 6 karakter"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleRegister}
      />

      <Button
        label="Daftar"
        icon="person-add-outline"
        loading={loading}
        onPress={handleRegister}
        style={styles.submit}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Sudah punya akun?</Text>
        <Link href="/(auth)/login" style={styles.link}>
          Masuk
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: '700', color: Brand.text, marginBottom: Space.sm },
  roleRow: { flexDirection: 'row', gap: Space.sm },
  roleCard: {
    flex: 1,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: '#F7F9FC',
  },
  roleCardActive: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  roleIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconActive: { borderColor: Brand.primaryBorder },
  roleCheck: { position: 'absolute', top: Space.sm, right: Space.sm },
  roleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.sm,
  },
  roleTitleActive: { color: Brand.primary },
  roleDescription: {
    fontSize: 10.5,
    lineHeight: 14,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  pressed: { opacity: 0.8 },
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
