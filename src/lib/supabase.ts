import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Mendukung dua nama env: ANON_KEY (standar) atau KEY (format publishable key baru).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase belum dikonfigurasi. Isi EXPO_PUBLIC_SUPABASE_URL dan ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY di .env.local, lalu restart expo (npx expo start --clear).',
  );
}

/**
 * Batas waktu request. Tanpa ini, satu request yang menggantung (mis. refresh
 * token saat jaringan berpindah) membuat semua pemanggilan `getSession()`
 * menunggu selamanya dan aplikasi berhenti di layar loading.
 *
 * Nilai sengaja longgar untuk operasi berat (upload foto, Edge Function
 * pembayaran/AI) agar tidak memotong proses yang masih berjalan.
 */
const AUTH_TIMEOUT_MS = 20_000;
const REST_TIMEOUT_MS = 25_000;
const STORAGE_TRANSFER_TIMEOUT_MS = 120_000;
const FUNCTIONS_TIMEOUT_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 30_000;

type FetchInput = RequestInfo | URL;
type FetchInit = RequestInit;

/** Label endpoint tanpa query string/path objek agar tidak ada data sensitif di log. */
function endpointLabel(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean).slice(0, 2);
  return parts.length ? parts.join('/') : 'unknown';
}

/**
 * Ambil path dari URL absolut tanpa bergantung pada polyfill `URL`
 * (implementasinya berbeda-beda di React Native/Hermes).
 */
function pathFromUrl(raw: string): string {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]+(\/[^?#]*)?/i.exec(raw);
  if (match) return match[1] || '/';
  return raw.startsWith('/') ? raw.split(/[?#]/)[0] : '';
}

function requestPath(input: FetchInput): string {
  try {
    if (typeof input === 'string') return pathFromUrl(input);
    if ('url' in input) return pathFromUrl(input.url);
    return pathFromUrl(input.toString());
  } catch {
    return '';
  }
}

/** Normalisasi input `fetch` (RN/Expo mengirim URL sebagai string). */
function toRequestInfo(input: FetchInput): RequestInfo {
  if (typeof input === 'string') return input;
  if ('url' in input) return input;
  return input.toString();
}

function requestMethod(input: FetchInput, init?: FetchInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function timeoutFor(pathname: string, method: string): number {
  if (pathname.startsWith('/auth/v1')) return AUTH_TIMEOUT_MS;
  if (pathname.startsWith('/rest/v1')) return REST_TIMEOUT_MS;
  if (pathname.startsWith('/functions/v1')) return FUNCTIONS_TIMEOUT_MS;
  if (pathname.startsWith('/storage/v1')) {
    return method === 'GET' || method === 'HEAD'
      ? REST_TIMEOUT_MS
      : STORAGE_TRANSFER_TIMEOUT_MS;
  }
  return DEFAULT_TIMEOUT_MS;
}

/**
 * `fetch` dengan batas waktu. Request yang melewati batas dibatalkan sehingga
 * promise selalu selesai (sukses, error jaringan, atau timeout) dan UI bisa
 * menampilkan status gagal + tombol coba lagi.
 */
const fetchWithTimeout = async (input: FetchInput, init?: FetchInit): Promise<Response> => {
  const controller = new AbortController();
  const pathname = requestPath(input);
  const method = requestMethod(input, init);
  const timeoutMs = timeoutFor(pathname, method);

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const outerSignal =
    init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null);
  const forwardAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener('abort', forwardAbort);
  }

  // RN/Expo mengirim URL sebagai string; normalisasi agar tipe aman.
  const requestInfo = toRequestInfo(input);

  try {
    return await fetch(requestInfo, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      // Hanya nama endpoint kasar yang dicetak; tidak ada token/filter/objek path.
      console.warn(
        `[supabase] ${method} ${endpointLabel(pathname)} melewati batas ${timeoutMs} ms`,
      );
      const timeoutError = new Error('Server tidak merespons. Periksa koneksi lalu coba lagi.');
      timeoutError.name = 'SupabaseTimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', forwardAbort);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout as typeof fetch,
  },
});
