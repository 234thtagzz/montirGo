import { useCallback, useEffect, useRef, useState } from 'react';

import { getSessionUser, type AuthUser } from '@/features/auth/service';
import { SessionUnavailableError } from '@/lib/auth-session';
import { subscribeAuthChange, subscribeForeground } from '@/lib/app-lifecycle';

/**
 * Batas waktu tampilan loading. Request Supabase sudah punya timeout sendiri;
 * watchdog ini lapis kedua agar layar tidak pernah terjebak selamanya bila
 * penyimpanan lokal atau inisialisasi auth tersendat.
 */
const SESSION_WATCHDOG_MS = 15_000;

export type SessionUserError = 'network' | 'session' | null;

// Sesi + profil/role dari database dalam satu hook (dipakai guard & layar).
export function useSessionUser() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SessionUserError>(null);
  const mounted = useRef(true);
  // Menyimpan pengguna terakhir agar kegagalan jaringan sesaat tidak
  // mengosongkan layar yang sudah menampilkan data.
  const userRef = useRef<AuthUser | null>(null);

  const applyResult = useCallback((next: AuthUser | null) => {
    if (!mounted.current) return;
    userRef.current = next;
    setUser(next);
    setError(next ? null : 'session');
  }, []);

  const applyError = useCallback((caught: unknown) => {
    if (!mounted.current) return;
    if (caught instanceof SessionUnavailableError) {
      // Sesi mungkin masih valid; jangan paksa logout hanya karena jaringan.
      // Bila pengguna sudah tampil, biarkan datanya dan coba lagi nanti.
      if (!userRef.current) setError('network');
      return;
    }
    userRef.current = null;
    setUser(null);
    setError('session');
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyResult(await getSessionUser());
    } catch (caught) {
      applyError(caught);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [applyError, applyResult]);

  useEffect(() => {
    mounted.current = true;
    let settled = false;

    const watchdog = setTimeout(() => {
      if (settled || !mounted.current) return;
      // Profil lambat bukan alasan menampilkan loading abadi.
      setLoading(false);
      setError((current) => current ?? 'network');
    }, SESSION_WATCHDOG_MS);

    (async () => {
      try {
        applyResult(await getSessionUser());
      } catch (caught) {
        applyError(caught);
      } finally {
        settled = true;
        clearTimeout(watchdog);
        if (mounted.current) setLoading(false);
      }
    })();

    return () => {
      mounted.current = false;
      clearTimeout(watchdog);
    };
  }, [applyError, applyResult]);

  // Satu listener auth global (dipasang di root layout) diteruskan ke sini.
  useEffect(
    () =>
      subscribeAuthChange((event) => {
        if (event === 'signed-out') {
          if (!mounted.current) return;
          userRef.current = null;
          setUser(null);
          setError('session');
          setLoading(false);
          return;
        }
        void refresh();
      }),
    [refresh],
  );

  // Verifikasi ulang sesi + role saat app kembali aktif, dibatasi 5 menit agar
  // beberapa layar yang memakai hook ini tidak memicu badai query bersamaan.
  const lastCheckedRef = useRef<number | null>(null);
  useEffect(
    () =>
      subscribeForeground(() => {
        const now = Date.now();
        const last = lastCheckedRef.current;
        lastCheckedRef.current = now;
        if (last !== null && now - last < 5 * 60_000) return;
        void refresh();
      }),
    [refresh],
  );

  return { user, loading, error, refresh };
}
