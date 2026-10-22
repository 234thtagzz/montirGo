import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { getSessionUser } from '@/features/auth/service';

export default function RootIndex() {
  const [target, setTarget] = useState<'/(auth)/login' | '/(client)' | '/(mechanic)' | null>(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        // Role diambil dari tabel profiles (database), bukan dari client.
        const user = await getSessionUser();
        if (!user) {
          setTarget('/(auth)/login');
          return;
        }
        setTarget(user.role === 'MONTIR' ? '/(mechanic)' : '/(client)');
      } catch {
        setTarget('/(auth)/login');
      }
    };
    resolve();
  }, []);

  // Lanjutkan visual splash yang sama supaya transisi ke halaman berikutnya mulus.
  if (!target) {
    return <AppLoadingScreen instant status="Menyiapkan sesi…" />;
  }

  return <Redirect href={target} />;
}
