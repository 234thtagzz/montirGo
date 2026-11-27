import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { AuthField } from '@/features/auth/components/auth-field';
import {
  getAuthErrorMessage,
  setMyIdentityNumber,
  useAuth,
} from '@/features/auth/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface IdentityRequiredScreenProps {
  onSaved: () => void | Promise<void>;
}

/**
 * Gerbang wajib verifikasi KTP 16 digit (tanpa Alert.alert).
 */
export function IdentityRequiredScreen({ onSaved }: IdentityRequiredScreenProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();

  const [identityNumber, setIdentityNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const identityError = !/^\d{16}$/.test(identityNumber)
    ? 'Nomor identitas (KTP) wajib diisi 16 digit angka.'
    : null;

  const handleSave = async () => {
    setSubmitted(true);
    if (identityError) return;
    setSaving(true);
    try {
      await setMyIdentityNumber(identityNumber);
      await onSaved();
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Gagal menyimpan',
        message: getAuthErrorMessage(error, 'Nomor identitas gagal disimpan. Coba lagi.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setLogoutVisible(false);
      router.replace('/(auth)/login');
    } catch {
      setLoggingOut(false);
      showToast({
        tone: 'danger',
        title: 'Gagal keluar',
        message: 'Tidak dapat keluar sekarang. Coba lagi.',
      });
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.hero, { paddingTop: insets.top + theme.spacing.xxl }]}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="shield-checkmark-outline"
            size={26}
            color={theme.colors.statusInfoFg}
          />
        </View>
        <AppText variant="overline" tone="info">
          VERIFIKASI IDENTITAS
        </AppText>
        <AppText variant="h1">Lengkapi Nomor Identitas (KTP)</AppText>
        <AppText variant="body" tone="secondary">
          Demi keamanan akun, nomor identitas wajib diisi sebelum kamu melanjutkan.
        </AppText>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Surface variant="default" padding="lg" style={styles.card}>
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
              returnKeyType="done"
              error={identityError}
              showError={submitted}
              onSubmitEditing={() => void handleSave()}
            />

            <View style={styles.note}>
              <Ionicons name="lock-closed" size={16} color={theme.colors.statusWarningFg} />
              <AppText variant="caption" tone="warning" style={styles.flexCopy}>
                Nomor identitas hanya bisa diisi satu kali dan bersifat permanen. Pastikan 16 digit sudah benar sesuai KTP.
              </AppText>
            </View>

            <Button
              label="Simpan & Lanjutkan"
              icon="checkmark-circle-outline"
              size="cta"
              loading={saving}
              onPress={() => void handleSave()}
            />
          </Surface>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keluar dari akun"
            disabled={loggingOut}
            onPress={() => setLogoutVisible(true)}
            style={({ pressed }) => [styles.logoutBtn, (pressed || loggingOut) && styles.pressed]}
          >
            <AppText variant="label" tone="secondary">
              {loggingOut ? 'Keluar…' : 'Keluar dari akun'}
            </AppText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={logoutVisible}
        destructive
        loading={loggingOut}
        icon="log-out-outline"
        title="Keluar dari akun?"
        message="Nomor identitas wajib dilengkapi sebelum kamu dapat memakai MontirGo."
        confirmLabel="Keluar"
        onConfirm={() => void confirmLogout()}
        onCancel={() => (loggingOut ? undefined : setLogoutVisible(false))}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  flex: { flex: 1 },
  hero: {
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: theme.spacing.sm,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.statusInfoBg,
    borderWidth: 1,
    borderColor: theme.colors.statusInfoBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  card: {
    gap: theme.spacing.md,
  },
  note: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.sm,
    padding: theme.spacing.md,
  },
  flexCopy: { flex: 1 },
  logoutBtn: {
    minHeight: theme.touchTarget.min,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: { opacity: 0.65 },
});
