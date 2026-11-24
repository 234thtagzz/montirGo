import { AppState, type AppStateStatus } from 'react-native';

import { ensureFreshSession } from '@/lib/auth-session';
import { clearSignedUrlCaches } from '@/lib/signed-url-cache';
import { supabase } from '@/lib/supabase';

/**
 * Siklus hidup sesi di React Native.
 *
 * Timer JS berhenti saat aplikasi di-background, sehingga refresh token bisa
 * tertinggal. Saat aplikasi kembali aktif kita:
 *   1. menyalakan kembali auto-refresh,
 *   2. memastikan token masih segar,
 *   3. memberi sinyal ke layar agar memuat ulang data.
 *
 * Listener auth dipasang sekali di sini (bukan di setiap hook) supaya tidak
 * ada puluhan subscription `onAuthStateChange`.
 */

export type AuthLifecycleEvent = 'signed-in' | 'signed-out';

type ForegroundListener = () => void;
type AuthListener = (event: AuthLifecycleEvent) => void;

const foregroundListeners = new Set<ForegroundListener>();
const authListeners = new Set<AuthListener>();

let foregroundEpoch = 0;
let started = false;
let lastState: AppStateStatus | null = (AppState.currentState as AppStateStatus | null) ?? null;

function emitForeground(): void {
  foregroundEpoch += 1;
  foregroundListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Satu layar gagal memuat ulang tidak boleh menghentikan layar lain.
    }
  });
}

function emitAuth(event: AuthLifecycleEvent): void {
  authListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // abaikan; listener layar bersifat best-effort
    }
  });
}

function handleForeground(): void {
  // Sinyal ke layar dikirim lebih dulu supaya UI langsung memuat ulang; query
  // yang membutuhkan token baru akan menunggu refresh yang sama (single-flight
  // di auth-js) alih-alih menahan seluruh layar.
  emitForeground();
  void (async () => {
    try {
      await supabase.auth.startAutoRefresh();
      await ensureFreshSession();
    } catch {
      // Offline/timeout: layar menampilkan status gagal + tombol coba lagi.
    }
  })();
}

/**
 * Pasang listener AppState + auth. Panggil sekali di root layout dan gunakan
 * nilai kembaliannya sebagai cleanup.
 */
export function startAppLifecycle(): () => void {
  if (started) return () => {};
  started = true;
  lastState = (AppState.currentState as AppStateStatus | null) ?? null;

  // autoRefreshToken sudah aktif dari createClient; panggilan ini memastikan
  // timer berjalan lagi setelah aplikasi dibuka dari background.
  void supabase.auth.startAutoRefresh().catch(() => {});

  const appStateSubscription = AppState.addEventListener('change', (state) => {
    const returningToForeground = state === 'active' && lastState !== 'active';
    lastState = state;

    if (state === 'active') {
      if (returningToForeground) void handleForeground();
      else void supabase.auth.startAutoRefresh().catch(() => {});
    } else {
      void supabase.auth.stopAutoRefresh().catch(() => {});
    }
  });

  const {
    data: { subscription: authSubscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      // Signed URL adalah kredensial sementara; jangan biarkan tetap di memori.
      clearSignedUrlCaches();
      emitAuth('signed-out');
      return;
    }
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      emitAuth('signed-in');
    }
  });

  return () => {
    started = false;
    appStateSubscription.remove();
    authSubscription.unsubscribe();
  };
}

/** Daftar callback yang dipanggil setiap aplikasi kembali ke foreground. */
export function subscribeForeground(listener: ForegroundListener): () => void {
  foregroundListeners.add(listener);
  return () => {
    foregroundListeners.delete(listener);
  };
}

/** Daftar callback untuk perubahan status login (tanpa subscription Supabase baru). */
export function subscribeAuthChange(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

export function getForegroundEpoch(): number {
  return foregroundEpoch;
}
