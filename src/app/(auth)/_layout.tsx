import { Stack } from 'expo-router';

/**
 * Layout grup autentikasi (login, daftar, pilih peran).
 *
 * Tanpa file ini grup `(auth)` tidak terdaftar sebagai satu route di root
 * Stack, sehingga muncul peringatan:
 * `[Layout children]: No route named "(auth)" exists in nested children`.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
