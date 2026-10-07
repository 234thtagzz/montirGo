import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { getApiErrorMessage, isAccountNotFound, useAuth } from '@/lib/api';

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
        router.replace('/(mechanic)');
      } else {
        router.replace('/(client)');
      }
    } catch (error) {
      const message = getApiErrorMessage(error, 'Email atau kata sandi salah.');
      if (isAccountNotFound(error)) {
        // User belum punya akun -> arahkan ke register
        Alert.alert('Akun Tidak Ditemukan', message, [
          { text: 'Coba Lagi', style: 'cancel' },
          { text: 'Daftar Sekarang', onPress: () => router.push('/(auth)/register') },
        ]);
      } else {
        Alert.alert('Login Gagal', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Login MontirGo</Text>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          placeholder="Kata Sandi"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
        />
        <Pressable onPress={handleLogin} disabled={loading} style={styles.button}>
          {loading ? (
            <Text style={styles.buttonText}>Sedang login...</Text>
          ) : (
            <Text style={styles.buttonText}>Masuk</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Belum punya akun? </Text>
          <Link href="/(auth)/register" style={styles.link}>
            Daftar Sekarang
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
    marginBottom: 32,
    color: '#1a1a1a',
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
