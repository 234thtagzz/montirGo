import {
  authenticate,
  clamp,
  cors,
  getServiceClient,
  getUserClient,
  isValidUuid,
  json,
  optionalEnv,
  requireEnv,
} from './http.ts';

export {
  authenticate,
  clamp,
  cors,
  getServiceClient,
  getUserClient,
  isValidUuid,
  json,
  optionalEnv,
  requireEnv,
};

/** Parse fee percentage safely without treating empty/null strings as 0%. */
export function parseFeePercent(raw: unknown, fallback = 10): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clamp(raw, 0, 50);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return clamp(fallback, 0, 50);
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return clamp(parsed, 0, 50);
  }
  return clamp(fallback, 0, 50);
}

/** Cek apakah minimal satu env token webhook sudah dikonfigurasi. */
export function webhookTokenConfigured(): boolean {
  const candidates = [
    'XENDIT_WEBHOOK_TOKEN',
    'XENDIT_WEBHOOK_SECRET',
    'XENDIT_CALLBACK_TOKEN',
  ];
  return candidates.some((name) => Boolean(Deno.env.get(name)?.trim()));
}

/** Verifikasi token callback webhook Xendit (`x-callback-token`). */
export function verifyCallbackToken(req: Request): boolean {
  const expected = [
    Deno.env.get('XENDIT_WEBHOOK_TOKEN'),
    Deno.env.get('XENDIT_WEBHOOK_SECRET'),
    Deno.env.get('XENDIT_CALLBACK_TOKEN'),
  ]
    .map((v) => v?.trim())
    .find(Boolean);

  if (!expected) return false;

  const incoming =
    req.headers.get('x-callback-token')?.trim() ??
    req.headers.get('x-webhook-token')?.trim() ??
    '';

  if (incoming.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < incoming.length; i += 1) {
    diff |= incoming.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export interface XenditResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
  /** True for network/timeout/5xx where upstream outcome is uncertain (never auto-refund). */
  isAmbiguous?: boolean;
  raw?: unknown;
}

export interface XenditRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  idempotencyKey?: string;
  apiVersion?: string;
  timeoutMs?: number;
}

/** Panggil Xendit API dengan Basic auth (secret key sebagai username) + 15s timeout. */
export async function xenditRequest<T>(
  path: string,
  options: XenditRequestOptions = {},
): Promise<XenditResult<T>> {
  const secretKey = requireEnv('XENDIT_SECRET_KEY');
  const baseUrl = optionalEnv('XENDIT_BASE_URL') ?? 'https://api.xendit.co';
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    'Content-Type': 'application/json',
  };
  if (options.apiVersion) headers['api-version'] = options.apiVersion;
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Koneksi ke Xendit terputus';
    return {
      ok: false,
      status: 0,
      errorCode: 'XENDIT_NETWORK_TIMEOUT',
      errorMessage: message,
      isAmbiguous: true,
    };
  }

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { message: text };
  }

  if (!res.ok) {
    const errorCode = typeof parsed.error_code === 'string' ? parsed.error_code : undefined;
    const errorMessage =
      typeof parsed.message === 'string'
        ? parsed.message
        : `Xendit mengembalikan status ${res.status}`;
    return {
      ok: false,
      status: res.status,
      errorCode,
      errorMessage,
      isAmbiguous: res.status >= 500 || res.status === 429,
      raw: parsed,
    };
  }

  return { ok: true, status: res.status, data: parsed as T };
}

/** Terjemahkan kode error Xendit ke pesan ramah Bahasa Indonesia. */
export function friendlyXenditError(
  errorCode: string | undefined,
  fallback?: string,
): string {
  switch (errorCode) {
    case 'INSUFFICIENT_BALANCE':
      return 'Saldo platform di Xendit sedang tidak mencukupi. Coba lagi nanti.';
    case 'CHANNEL_UNAVAILABLE':
      return 'Bank/e-wallet tujuan sedang gangguan. Coba lagi nanti.';
    case 'INVALID_DESTINATION':
      return 'Nomor rekening atau e-wallet tidak valid.';
    case 'RECIPIENT_ACCOUNT_NUMBER_ERROR':
      return 'Nomor rekening tujuan tidak ditemukan di bank terkait.';
    case 'INVALID_AMOUNT':
    case 'MINIMUM_AMOUNT':
      return 'Nominal berada di luar batas yang didukung.';
    case 'MAXIMUM_AMOUNT':
      return 'Nominal melebihi batas transaksi.';
    case 'DUPLICATE_ERROR':
    case 'IDEMPOTENCY_ERROR':
      return 'Permintaan duplikat terdeteksi. Memeriksa status transaksi.';
    case 'XENDIT_NETWORK_TIMEOUT':
      return 'Koneksi ke gateway pembayaran lambat. Periksa status transaksi.';
    default:
      return fallback ?? 'Gagal terhubung ke gateway pembayaran.';
  }
}

/** Kembalikan true jika sesi Xendit sudah berstatus COMPLETED dan pembayaran tunai harus diblokir. */
export function isXenditSessionCompleted(status: unknown): boolean {
  return typeof status === 'string' && status.trim().toUpperCase() === 'COMPLETED';
}
