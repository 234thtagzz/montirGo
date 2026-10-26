// Helper bersama untuk Edge Function pembayaran Xendit.
// Secret key HANYA ada di server (Supabase secrets), tidak pernah di aplikasi mobile.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Konfigurasi server belum lengkap: ${name}`);
  return value;
}

function optionalEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  return undefined;
}

export function getServiceClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Client dengan JWT user — dipakai agar auth.uid() bekerja di RPC. */
export function getUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) throw new Error('UNAUTHORIZED');
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticate(req: Request) {
  const sb = getUserClient(req);
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  if (error || !user) throw new Error('UNAUTHORIZED');
  return { sb, user };
}

/** Apakah token webhook sudah dikonfigurasi di server? */
export function webhookTokenConfigured(): boolean {
  return Boolean(
    optionalEnv(
      'XENDIT_WEBHOOK_TOKEN',
      'XENDIT_WEBHOOK_SECRET',
      'PAYMENT_GATEWAY_WEBHOOK_SECRET',
    ),
  );
}

/** Verifikasi header x-callback-token dari Xendit. */
export function verifyCallbackToken(req: Request): boolean {
  const expected = optionalEnv(
    'XENDIT_WEBHOOK_TOKEN',
    'XENDIT_WEBHOOK_SECRET',
    'PAYMENT_GATEWAY_WEBHOOK_SECRET',
  );
  if (!expected) return false;
  const received = req.headers.get('x-callback-token') ?? '';
  return timingSafeEqual(received, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface XenditResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorCode: string | null;
  message: string | null;
}

interface XenditOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  idempotencyKey?: string;
  apiVersion?: string;
}

/** Panggil Xendit API dengan Basic auth (secret key sebagai username). */
export async function xenditRequest<T>(
  path: string,
  options: XenditOptions = {},
): Promise<XenditResult<T>> {
  const secretKey = requireEnv('XENDIT_SECRET_KEY');
  const baseUrl = optionalEnv('XENDIT_BASE_URL') ?? 'https://api.xendit.co';
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
  if (options.apiVersion) headers['api-version'] = options.apiVersion;

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const record = (parsed ?? {}) as Record<string, unknown>;
    return {
      ok: false,
      status: response.status,
      data: null,
      errorCode: typeof record.error_code === 'string' ? record.error_code : null,
      message: typeof record.message === 'string' ? record.message : raw.slice(0, 300),
    };
  }

  return {
    ok: true,
    status: response.status,
    data: parsed as T,
    errorCode: null,
    message: null,
  };
}

/** Pesan error yang aman ditampilkan ke pengguna. */
export function friendlyXenditError(
  errorCode: string | null,
  message: string | null,
  fallback: string,
): string {
  switch (errorCode) {
    case 'INSUFFICIENT_BALANCE':
      return 'Saldo platform di Xendit belum cukup. Coba lagi setelah settlement berikutnya.';
    case 'INVALID_DESTINATION':
    case 'RECIPIENT_ACCOUNT_NUMBER_ERROR':
      return 'Nomor rekening tidak valid. Periksa kembali rekening tujuan.';
    case 'ACCOUNT_NAME_MISMATCH':
      return 'Nama pemilik rekening tidak cocok dengan data bank.';
    case 'MINIMUM_TRANSFER_LIMIT_ERROR':
    case 'AMOUNT_TOO_LOW':
      return 'Nominal pencairan di bawah batas minimum Xendit.';
    case 'MAXIMUM_TRANSFER_LIMIT_ERROR':
    case 'AMOUNT_TOO_HIGH':
      return 'Nominal pencairan melebihi batas maksimum Xendit.';
    case 'DUPLICATE_ERROR':
      return 'Permintaan pencairan ini sudah pernah diproses.';
    default:
      return message || fallback;
  }
}
