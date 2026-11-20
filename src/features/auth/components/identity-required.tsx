import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { AuthField } from '@/features/auth/components/auth-field';
import {
  getAuthErrorMessage,
  setMyIdentityNumber,
  useAuth,
} from '@/features/auth/service';

interface IdentityRequiredScreenProps {
  /** Dipanggil setelah nomor identitas tersimpan (memuat ulang sesi/user). */
  onSaved: () => void | Promise<void>;
}

/**
 * Gerbang wajib setelah login: akun lama yang belum punya nomor identitas
 * (KTP) harus melengkapinya sebelum bisa memakai aplikasi. Nomor hanya bisa
 * diisi sekali — setelah tersimpan UI ini tidak muncul lagi.
 */
export function IdentityRequiredScreen({ onSaved }: IdentityRequiredScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const [identityNumber, setIdentityNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSave = async () => {
    if (!/^\d{16}$/.test(identityNumber)) {
      Alert.alert('Gagal', 'Nomor identitas (KTP) wajib diisi 16 digit angka.');
      return;
    }
    setSaving(true);
    try {
      await setMyIdentityNumber(identityNumber);
      await onSaved();
    } catch (error) {
      Alert.alert(
        'Gagal menyimpan',
        getAuthErrorMessage(error, 'Nomor identitas gagal disimpan. Coba lagi.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Keluar dari akun?',
      'Nomor identitas wajib dilengkapi sebelum kamu bisa memakai MontirGo.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Keluar',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.hero, { paddingTop: insets.top + Space.xxl }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={26} color={Brand.volt} />
        </View>
        <Text style={styles.eyebrow}>VERIFIKASI IDENTITAS</Text>
        <Text style={styles.title}>Lengkapi Nomor Identitas (KTP)</Text>
        <Text style={styles.subtitle}>
          Demi keamanan akun, nomor identitas wajib diisi sebelum kamu melanjutkan.
        </Text>
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
          <View style={styles.card}>
            <AuthField
              label="Nomor identitas (KTP)"
              icon="card-outline"
              placeholder="16 digit sesuai KTP"
              value={identityNumber}
              onChangeText={(text) => setIdentityNumber(text.replace(/\D/g, '').slice(0, 16))}
              autoComplete="off"
              keyboardType="number-pad"
              maxLength={16}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View style={styles.note}>
              <Ionicons name="lock-closed" size={14} color={Brand.amber} />
              <Text style={styles.noteText}>
                Nomor identitas hanya bisa diisi satu kali dan bersifat permanen. Pastikan 16
                digit sudah benar sesuai KTP.
              </Text>
            </View>

            <Button
              label="Simpan & Lanjutkan"
              icon="checkmark-circle-outline"
              loading={saving}
              onPress={handleSave}
              style={styles.submit}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keluar dari akun"
            disabled={loggingOut}
            onPress={handleLogout}
            style={({ pressed }) => [(pressed || loggingOut) && styles.pressed]}
          >
            <Text style={styles.logoutText}>
              {loggingOut ? 'Keluar…' : 'Keluar dari akun'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  hero: {
    backgroundColor: Brand.ink,
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.xxl,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Brand.inkSoft,
    borderWidth: 1,
    borderColor: Brand.inkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.lg,
  },
  eyebrow: { ...Type.micro, color: Brand.volt },
  title: { ...Type.h1, color: Brand.white, marginTop: Space.sm },
  subtitle: {
    ...Type.body,
    color: Brand.inkMuted,
    marginTop: Space.sm,
    lineHeight: 20,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: ScreenPadding,
    paddingTop: Space.xxl,
    paddingBottom: Space.xxxl,
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.sm,
    padding: Space.md,
    marginTop: Space.md,
  },
  noteText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: Brand.amber,
  },
  submit: { marginTop: Space.xl },
  logoutText: {
    ...Type.label,
    color: Brand.textSecondary,
    textAlign: 'center',
    marginTop: Space.xxl,
  },
  pressed: { opacity: 0.6 },
});
