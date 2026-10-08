import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { getApiErrorMessage, useAuth, type UserRole } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      // Langsung tersimpan ke MySQL (Railway) lewat POST /auth/register
      const { user } = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        role,
      });
      Alert.alert('Berhasil', `Akun ${user.role === 'MONTIR' ? 'Montir' : 'Client'} berhasil dibuat. Silakan login.`);
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('Gagal', getApiErrorMessage(error, 'Terjadi kesalahan saat pendaftaran.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Daftar MontirGo</Text>

        <Text style={styles.label}>Daftar sebagai</Text>
        <View style={styles.roleRow}>
          {(['CLIENT', 'MONTIR'] as const).map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={[styles.roleChip, role === r && styles.roleChipActive]}>
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                {r === 'CLIENT' ? 'Client' : 'Montir'}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          placeholder="Nama Lengkap"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          placeholder="Nomor Telepon"
          value={phone}
          onChangeText={setPhone}
          style={styles.input}
          keyboardType="phone-pad"
        />
        <TextInput
          placeholder="Kata Sandi (min. 6 karakter)"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
        />
        <Pressable onPress={handleRegister} disabled={loading} style={styles.button}>
          {loading ? (
            <Text style={styles.buttonText}>Mendaftar...</Text>
          ) : (
            <Text style={styles.buttonText}>Daftar</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Sudah punya akun? </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Masuk
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: 24,
    color: '#1a1a1a',
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleChip: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f7',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleChipActive: {
    backgroundColor: '#e8f1fe',
    borderColor: '#3c87f7',
  },
  roleChipText: {
    fontSize: 15,
    fontWeight: 600,
    color: '#60646c',
  },
  roleChipTextActive: {
    color: '#3c87f7',
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#f5f5f7',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#1a1a1a',
  },
  button: {
    backgroundColor: '#3c87f7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#60646c',
    fontSize: 14,
  },
  link: {
    color: '#3c87f7',
    fontSize: 14,
    fontWeight: 600,
  },
});
