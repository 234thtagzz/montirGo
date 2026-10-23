// Penerjemah error `supabase.functions.invoke` menjadi pesan yang bisa
// ditindaklanjuti. Tanpa ini, semua kegagalan Edge Function hanya muncul
// sebagai "Edge Function returned a non-2xx status code".

const DEPLOY_HINT: Record<string, string> = {
  'analyze-request': 'npx supabase functions deploy analyze-request',
  'ai-assistant': 'npx supabase functions deploy ai-assistant',
};

interface ResponseLike {
  status?: number;
  text?: () => Promise<string>;
  clone?: () => ResponseLike;
}

interface FunctionsErrorLike {
  name?: string;
  message?: string;
  context?: ResponseLike;
}

async function readBody(context: ResponseLike): Promise<{ status: number | null; message: string }> {
  const status = typeof context.status === 'number' ? context.status : null;
  let text = '';
  try {
    const readable = typeof context.clone === 'function' ? context.clone() : context;
    if (typeof readable.text === 'function') text = await readable.text();
  } catch {
    // Body tidak terbaca — cukup pakai status.
  }
  if (!text) return { status, message: '' };
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const message =
      typeof parsed.error === 'string'
        ? parsed.error
        : typeof parsed.message === 'string'
          ? parsed.message
          : '';
    return { status, message };
  } catch {
    return { status, message: text.slice(0, 200) };
  }
}

/**
 * Ubah error dari `supabase.functions.invoke` menjadi Error berpesan jelas.
 * Mengembalikan Error agar pemanggil tinggal `throw await describeFunctionError(...)`.
 */
export async function describeFunctionError(
  error: unknown,
  functionName: string,
  fallback = 'Layanan AI sedang bermasalah. Coba lagi nanti.',
): Promise<Error> {
  const err = (error ?? {}) as FunctionsErrorLike;
  const rawMessage = typeof err.message === 'string' ? err.message : '';

  // Gagal menghubungi server sama sekali (offline / DNS / CORS).
  if (err.name === 'FunctionsFetchError' || /failed to send a request/i.test(rawMessage)) {
    return new Error('Tidak bisa menghubungi server. Periksa koneksi internet lalu coba lagi.');
  }

  if (!err.context) {
    return new Error(rawMessage || fallback);
  }

  const { status, message } = await readBody(err.context);
  const deployHint = DEPLOY_HINT[functionName];

  if (status === 404) {
    return new Error(
      'Fitur AI belum aktif di server (Edge Function tidak ditemukan). ' +
        (deployHint
          ? `Deploy dulu: ${deployHint}`
          : 'Deploy Edge Function lalu coba lagi.'),
    );
  }
  if (status === 401) {
    return new Error('Sesi login berakhir. Silakan login ulang lalu coba lagi.');
  }
  if (status === 403) {
    return new Error(message || 'Kamu tidak punya akses ke fitur AI ini.');
  }
  if (message) return new Error(message);

  return new Error(status ? `${fallback} (HTTP ${status})` : fallback);
}
