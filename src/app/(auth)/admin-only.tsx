import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { AuthScreen } from '@/features/auth/components/auth-screen';
import { signOut } from '@/features/auth/service';

/**
 * Akun dengan role database 'admin' tidak boleh memakai aplikasi mobile.
 * Panel admin hanya tersedia di aplikasi web (montirgo-admin).
 */
export default function AdminOnlyScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch {
      Alert.alert('Gagal', 'Tidak dapat keluar. Coba lagi.');
    }
  };

  return (
    <AuthScreen
      title="Akun admin hanya untuk panel web"
      subtitle="Aplikasi mobile hanya untuk akun client dan montir. Silakan keluar lalu masuk dengan akun client atau montir, atau gunakan panel admin MontirGo di browser."
    >
      <Button label="Keluar" icon="log-out-outline" variant="danger" onPress={handleLogout} />
    </AuthScreen>
  );
}
