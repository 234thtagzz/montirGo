// Supabase Edge Function: xendit-webhook
// Menerima webhook pembayaran Xendit (Payment Session / Payment Request).
// Deploy: supabase functions deploy xendit-webhook --no-verify-jwt
// Secrets: XENDIT_WEBHOOK_TOKEN
//
// Alur: verifikasi token -> simpan event idempoten -> finalize_payment (RPC).
// Status pembayaran TIDAK pernah dipercaya dari aplikasi mobile.

import {
  getServiceClient,
  json,
  verifyCallbackToken,
  webhookTokenConfigured,
} from '../_shared/xendit.ts';

interface XenditWebhook {
  event?: string;
  created?: string;
  data?: {
    id?: string;
    reference_id?: string;
    payment_id?: string;
    payment_session_id?: string;
    payment_request_id?: string;
    status?: string;
    failure_code?: string;
    channel_code?: string;
    request_amount?: number;
    [key: string]: unknown;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  if (!webhookTokenConfigured()) {
    // Tanpa token, semua notifikasi Xendit akan ditolak. Tampilkan pesan jelas
    // agar terlihat di dashboard webhook Xendit.
    console.error('XENDIT_WEBHOOK_TOKEN belum di-set di Supabase secrets');
    return json({ error: 'XENDIT_WEBHOOK_TOKEN belum di-set di server' }, 500);
  }

  if (!verifyCallbackToken(req)) {
    return json({ error: 'Webhook token tidak valid' }, 401);
  }

  let body: XenditWebhook;
  try {
    body = (await req.json()) as XenditWebhook;
  } catch {
    return json({ error: 'Payload bukan JSON' }, 400);
  }

  const event = body.event ?? '';
  const data = body.data ?? {};
  const status = String(data.status ?? '').toUpperCase();

  const svc = getServiceClient();
  const sessionId = typeof data.payment_session_id === 'string' ? data.payment_session_id : null;
  const externalPaymentId =
    (typeof data.payment_id === 'string' ? data.payment_id : null) ??
    (typeof data.payment_request_id === 'string' ? data.payment_request_id : null) ??
    (typeof data.id === 'string' ? data.id : null);
  const referenceId = typeof data.reference_id === 'string' ? data.reference_id : null;

  // Cari baris payments: utamakan payment_session_id, lalu external id, lalu
  // reference_id (request id) bila payload tidak membawa id sesi.
  let payment: { id: string; request_id: string; status: string } | null = null;

  if (sessionId) {
    const { data: row } = await svc
      .from('payments')
      .select('id, request_id, status')
      .eq('payment_session_id', sessionId)
      .maybeSingle();
    payment = row ?? null;
  }

  if (!payment && externalPaymentId) {
    const { data: row } = await svc
      .from('payments')
      .select('id, request_id, status')
      .eq('external_payment_id', externalPaymentId)
      .maybeSingle();
    payment = row ?? null;
  }

  if (!payment && referenceId && isUuid(referenceId)) {
    const { data: row } = await svc
      .from('payments')
      .select('id, request_id, status')
      .eq('request_id', referenceId)
      .maybeSingle();
    payment = row ?? null;
  }

  if (!payment) {
    // Event untuk transaksi yang tidak dikenal — balas 200 agar Xendit tidak retry.
    console.warn('Webhook pembayaran tanpa baris payments', { event, referenceId, sessionId });
    return json({ ok: true, ignored: true });
  }

  const isSuccess =
    event === 'payment_session.completed' ||
    event === 'payment.capture' ||
    event === 'payment.succeeded' ||
    status === 'COMPLETED' ||
    (status === 'SUCCEEDED' && Boolean(externalPaymentId));

  const isFailure =
    event === 'payment_session.expired' ||
    event === 'payment.failure' ||
    ['EXPIRED', 'FAILED', 'CANCELED', 'CANCELLED'].includes(status);

  const eventId = [
    event || 'payment_event',
    sessionId ?? externalPaymentId ?? referenceId ?? payment.request_id,
    status || 'unknown',
  ].join(':');

  const { error: eventError } = await svc.from('payment_events').insert({
    payment_id: payment.id,
    event_id: eventId,
    event_type: event || `payment.${status.toLowerCase()}`,
    payload: body,
  });

  // Webhook duplikat tetap diproses: percobaan sebelumnya bisa sudah mencatat
  // event tetapi gagal saat finalize_payment. finalize_payment sendiri
  // idempoten (langsung keluar bila payments sudah 'paid').
  const isDuplicate = eventError?.code === '23505';
  if (eventError && !isDuplicate) {
    console.error('Gagal menyimpan payment event', eventError);
    return json({ error: 'Gagal menyimpan event' }, 500);
  }

  try {
    if (externalPaymentId) {
      await svc
        .from('payments')
        .update({ external_payment_id: externalPaymentId })
        .eq('id', payment.id);
    }

    if (isSuccess && payment.status !== 'paid') {
      const { error } = await svc.rpc('finalize_payment', { p_payment_id: payment.id });
      if (error) throw new Error(error.message);
      return json({ ok: true, finalized: true, duplicate: isDuplicate });
    }

    if (isDuplicate) {
      return json({ ok: true, duplicate: true });
    }

    if (isFailure && payment.status !== 'paid') {
      const nextStatus = status === 'FAILED' ? 'failed' : 'expired';
      await svc
        .from('payments')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', payment.id)
        .neq('status', 'paid');
      return json({ ok: true, status: nextStatus });
    }

    return json({ ok: true, ignored: true });
  } catch (error) {
    console.error('Gagal memproses webhook pembayaran', error);
    // 500 agar Xendit mengirim ulang webhook.
    return json({ error: 'Gagal memproses pembayaran' }, 500);
  }
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cegah query UUID gagal saat reference_id berupa teks bebas. */
function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
