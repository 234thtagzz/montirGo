import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { AuthField } from '@/features/auth/components/auth-field';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { getAuthErrorMessage, useAuth, type UserRole } from '@/features/auth/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole: UserRole =
    typeof params.role === 'string' && params.role.toUpperCase() === 'MONTIR' ? 'MONTIR' : 'CLIENT';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [identityNumber, setIdentityNumber] = useState('');
  const [role, setRole] = useState<UserRole>(initialRole);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const nameError = !name.trim() ? 'Nama lengkap wajib diisi.' : null;
  const emailError = !EMAIL_RE.test(email.trim()) ? 'Masukkan alamat email yang valid.' : null;
  const identityError = !/^\d{16}$/.test(identityNumber)
    ? 'Nomor identitas (KTP) wajib diisi 16 digit angka.'
    : null;
  const passwordError = password.length < 6 ? 'Kata sandi minimal 6 karakter.' : null;

  const handleRegister = async () => {
    setSubmitted(true);
    if (nameError || emailError || identityError || passwordError) {
      showToast({
        tone: 'warning',
        title: 'Periksa formulir',
        message: nameError ?? emailError ?? identityError ?? passwordError ?? 'Lengkapi kolom wajib.',
      });
      return;
    }

    setLoading(true);
    try {
      const { user, needsConfirmation } = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        identityNumber,
        role,
      });
      if (needsConfirmation || !user) {
        showToast({
          tone: 'info',
          title: 'Cek email kamu',
          message: 'Akun dibuat. Verifikasi email terlebih dahulu lalu login.',
        });
      } else {
        showToast({
          tone: 'success',
          title: 'Pendaftaran berhasil',
          message: `Akun ${user.role === 'MONTIR' ? 'Montir' : 'Client'} siap digunakan.`,
        });
      }
      router.replace('/(auth)/login');
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Gagal mendaftar',
        message: getAuthErrorMessage(error, 'Terjadi kesalahan saat pendaftaran.'),
      });
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
      <View style={styles.block}>
        <AppText variant="label">Daftar sebagai</AppText>
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
                    color={
                      active ? theme.colors.actionPrimaryFg : theme.colors.textSecondary
                    }
                  />
                </View>
                {active ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={theme.colors.actionPrimaryAltBg}
                    style={styles.roleCheck}
                  />
                ) : null}
                <AppText variant="label">{option.title}</AppText>
                <AppText variant="caption" tone="secondary">
                  {option.description}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <AuthField
        label="Nama lengkap"
        icon="person-outline"
        required
        placeholder="Contoh: Budi Santoso"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        error={nameError}
        showError={submitted}
      />
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
        label="Nomor WhatsApp (opsional)"
        icon="logo-whatsapp"
        placeholder="08xx xxxx xxxx"
        value={phone}
        onChangeText={setPhone}
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        returnKeyType="next"
      />
      <AuthField
        label="Nomor identitas (KTP)"
        icon="card-outline"
        required
        placeholder="16 digit sesuai KTP"
        value={identityNumber}
        onChangeText={(text) => setIdentityNumber(text.replace(/\D/g, '').slice(0, 16))}
        autoComplete="off"
        keyboardType="number-pad"
        maxLength={16}
        returnKeyType="next"
        error={identityError}
        showError={submitted}
      />
      <AuthField
        label="Kata sandi"
        icon="lock-closed-outline"
        required
        placeholder="Minimal 6 karakter"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        error={passwordError}
        showError={submitted}
        onSubmitEditing={() => void handleRegister()}
      />

      <Button
        label="Daftar"
        icon="person-add-outline"
        size="cta"
        loading={loading}
        onPress={() => void handleRegister()}
      />

      <View style={styles.footer}>
        <AppText variant="body" tone="secondary">
          Sudah punya akun?
        </AppText>
        <Link href="/(auth)/login" style={styles.link}>
          Masuk
        </Link>
      </View>
    </AuthScreen>
  );
}

const createStyles = (theme: AppTheme) => ({
  block: {
    gap: theme.spacing.sm,
  },
  roleRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  roleCard: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgCanvas,
    gap: theme.spacing.xs,
  },
  roleCardActive: {
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.statusInfoBg,
  },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  roleIconActive: {
    backgroundColor: theme.colors.actionPrimaryAltBg,
    borderColor: theme.colors.actionPrimaryAltBg,
  },
  roleCheck: {
    position: 'absolute' as const,
    top: theme.spacing.sm,
    right: theme.spacing.sm,
  },
  pressed: { opacity: 0.8 },
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
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
