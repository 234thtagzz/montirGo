import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { SessionRetryScreen } from '@/features/auth/components/session-retry';
import { getSessionUser } from '@/features/auth/service';
import { SessionUnavailableError } from '@/lib/auth-session';

type Target =
  | '/(auth)/login'
  | '/(auth)/admin-only'
  | '/(client)/(tabs)'
  | '/(mechanic)/(tabs)';

/** Batas tampil "Menyiapkan sesi…" sebelum menawarkan coba lagi. */
const RESOLVE_TIMEOUT_MS = 15_000;

export default function RootIndex() {
  const [target, setTarget] = useState<Target | null>(null);
  const [networkError, setNetworkError] = useState(false);

  const resolve = useCallback(async () => {
    setNetworkError(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Role diambil dari tabel profiles (database), bukan dari client.
      // Batas waktu mencegah splash "Menyiapkan sesi…" berlangsung terlalu lama
      // bila beberapa request berjalan berurutan saat jaringan buruk.
      const user = await Promise.race([
        getSessionUser(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new SessionUnavailableError()), RESOLVE_TIMEOUT_MS);
        }),
      ]);
      if (!user) {
        setTarget('/(auth)/login');
        return;
      }
      if (user.role === 'ADMIN') {
        // Admin hanya boleh memakai panel web, bukan aplikasi mobile.
        setTarget('/(auth)/admin-only');
        return;
      }
      setTarget(user.role === 'MONTIR' ? '/(mechanic)/(tabs)' : '/(client)/(tabs)');
    } catch (error) {
      if (error instanceof SessionUnavailableError) {
        // Jangan lempar pengguna ke login hanya karena jaringan sedang putus.
        setNetworkError(true);
        return;
      }
      setTarget('/(auth)/login');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Ditunda satu tick agar setState tidak berjalan sinkron di badan effect.
    const timer = setTimeout(() => {
      void resolve();
    }, 0);
    return () => clearTimeout(timer);
  }, [resolve]);

  if (networkError) {
    return (
      <SessionRetryScreen
        onRetry={() => {
          setTarget(null);
          void resolve();
        }}
      />
    );
  }

  // Lanjutkan visual splash yang sama supaya transisi ke halaman berikutnya mulus.
  if (!target) {
    return <AppLoadingScreen instant status="Menyiapkan sesi…" />;
  }

  return <Redirect href={target} />;
}
