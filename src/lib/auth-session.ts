import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * Sesi Supabase dibaca dari penyimpanan lokal (AsyncStorage) dan otomatis
 * di-refresh oleh auth-js bila mendekati kedaluwarsa. Semua request memakai
 * timeout di `lib/supabase.ts`, sehingga kegagalan jaringan tidak lagi membuat
 * proses refresh menggantung tanpa batas.
 */

/** Margin proaktif: refresh sebelum token benar-benar kedaluwarsa. */
const REFRESH_MARGIN_MS = 60_000;

/** Sesi benar-benar tidak ada / sudah tidak valid. Pemanggil harus login ulang. */
export class SessionExpiredError extends Error {
  constructor(message = 'Sesi berakhir. Silakan login kembali.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/** Sesi belum bisa diverifikasi karena gangguan jaringan (bukan logout). */
export class SessionUnavailableError extends Error {
  constructor(
    message = 'Tidak dapat memeriksa sesi karena koneksi bermasalah. Periksa internet lalu coba lagi.',
  ) {
    super(message);
    this.name = 'SessionUnavailableError';
  }
}

function errorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message ?? '');
  }
  return '';
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const record = error as { status?: unknown; statusCode?: unknown };
  const value = record.status ?? record.statusCode;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
  return null;
}

/**
 * Error yang menandakan token akses tidak diterima server (401 / JWT expired).
 * Dipakai untuk memutuskan kapan perlu refresh + ulang sekali.
 */
export function isAuthError(error: unknown): boolean {
  if (!error) return false;
  if (errorStatus(error) === 401) return true;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code ?? '')
      : '';
  if (code === 'PGRST301' || code === 'PGRST302' || code === '401') return true;
  return /jwt expired|invalid jwt|invalid claim|not authenticated|auth session missing|refresh token (?:is )?(?:invalid|not found)|token has expired/i.test(
    errorMessage(error),
  );
}

/** Error refresh token yang permanen: sesi memang sudah tidak bisa dipakai. */
function isPermanentSessionError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code ?? '')
      : '';
  if (code === 'refresh_token_not_found' || code === 'invalid_grant') return true;
  return /invalid refresh token|refresh token not found|invalid_grant|token has been revoked|user not found/i.test(
    errorMessage(error),
  );
}

function logAuthWarning(message: string): void {
  // Hanya pesan status yang dicetak — tidak pernah token, header, atau URL.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn('[auth]', message);
  }
}

/**
 * Baca sesi lokal. `getSession()` akan me-refresh token yang hampir habis.
 *
 * - Sesi tidak ada / refresh token permanen tidak valid -> `null`.
 * - Gagal sementara (timeout/offline) -> `SessionUnavailableError`, supaya UI
 *   menampilkan tombol coba lagi alih-alih memaksa logout.
 */
export async function readSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (isPermanentSessionError(error)) return null;
      logAuthWarning(`sesi belum dapat diverifikasi: ${errorMessage(error) || 'gangguan jaringan'}`);
      throw new SessionUnavailableError();
    }
    return data.session;
  } catch (error) {
    if (error instanceof SessionUnavailableError) throw error;
    if (isPermanentSessionError(error)) return null;
    logAuthWarning(`sesi belum dapat diverifikasi: ${errorMessage(error) || 'gangguan jaringan'}`);
    throw new SessionUnavailableError();
  }
}

/**
 * Id pengguna dari sesi lokal. Tidak memanggil endpoint `/auth/v1/user`, jadi
 * tidak menambah request jaringan di setiap query database.
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await readSession();
  const id = session?.user?.id;
  if (!id) throw new SessionExpiredError();
  return id;
}

let refreshInFlight: Promise<Session | null> | null = null;

/**
 * Pastikan token masih segar. Dipakai saat aplikasi kembali ke foreground.
 * Tidak pernah melempar error: kegagalan sementara cukup membuat pemanggil
 * memakai sesi tersimpan, dan `readSession()` akan mencoba lagi nanti.
 */
export async function ensureFreshSession(options?: { force?: boolean }): Promise<Session | null> {
  let session: Session | null = null;
  try {
    session = await readSession();
  } catch {
    return null;
  }
  if (!session) return null;

  const expiresAt = (session.expires_at ?? 0) * 1000;
  const shouldRefresh =
    options?.force === true || (expiresAt > 0 && expiresAt - Date.now() < REFRESH_MARGIN_MS);
  if (!shouldRefresh) return session;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          if (isPermanentSessionError(error)) {
            logAuthWarning('refresh token tidak valid; sesi lokal dibersihkan.');
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
            return null;
          }
          return null;
        }
        return data.session ?? null;
      } catch {
        // Offline/timeout: biarkan sesi tersimpan, coba lagi pada foreground berikutnya.
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}
