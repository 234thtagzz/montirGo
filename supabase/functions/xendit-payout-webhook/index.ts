// Supabase Edge Function: xendit-payout-webhook
// Menerima webhook Xendit Payouts v3 dan menyelesaikan status pencairan.
// Deploy: supabase functions deploy xendit-payout-webhook --no-verify-jwt
// Secrets: XENDIT_PAYOUT_WEBHOOK_TOKEN (fallback ke XENDIT_WEBHOOK_TOKEN)
//
// Alur: verifikasi token -> cari withdrawal -> simpan event idempoten ->
// settle_withdrawal (RPC) untuk status terminal.

import { getServiceClient, json } from '../_shared/xendit.ts';

interface PayoutWebhook {
  event?: string;
  created?: string;
  data?: {
    id?: string;
    payout_id?: string;
    reference_id?: string;
    status?: string;
    failure_code?: string;
    failure_reason?: string;
    amount?: number;
    [key: string]: unknown;
  };
}

const TERMINAL: Record<string, 'succeeded' | 'failed' | 'cancelled'> = {
  'v3_payout.succeeded': 'succeeded',
  'v3_payout.failed': 'failed',
  'v3_payout.rejected': 'failed',
  'v3_payout.reversed': 'failed',
  'v3_payout.cancelled': 'cancelled',
};

// Status di dalam payload juga dipakai bila `event` tidak dikirim.
const STATUS_MAP: Record<string, 'succeeded' | 'failed' | 'cancelled'> = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REJECTED: 'failed',
  REVERSED: 'failed',
  CANCELLED: 'cancelled',
  CANCELED: 'cancelled',
};

function verifyPayoutToken(req: Request): boolean {
  const expected =
    Deno.env.get('XENDIT_PAYOUT_WEBHOOK_TOKEN') ??
    Deno.env.get('XENDIT_WEBHOOK_TOKEN') ??
    Deno.env.get('XENDIT_WEBHOOK_SECRET') ??
    '';
  if (!expected) return false;
  const received = req.headers.get('x-callback-token') ?? '';
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i += 1) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  if (!verifyPayoutToken(req)) {
    return json({ error: 'Webhook token tidak valid' }, 401);
  }

  let body: PayoutWebhook;
  try {
    body = (await req.json()) as PayoutWebhook;
  } catch {
    return json({ error: 'Payload bukan JSON' }, 400);
  }

  const event = body.event ?? '';
  const data = body.data ?? {};
  const payoutId = typeof data.payout_id === 'string'
    ? data.payout_id
    : typeof data.id === 'string'
      ? data.id
      : null;
  const referenceId = typeof data.reference_id === 'string' ? data.reference_id : null;
  const status = String(data.status ?? '').toUpperCase();

  if (!payoutId && !referenceId) {
    return json({ ok: true, ignored: true });
  }

  const svc = getServiceClient();

  let withdrawal: { id: string; status: string } | null = null;

  if (payoutId) {
    const { data: row } = await svc
      .from('withdrawals')
      .select('id, status')
      .eq('xendit_payout_id', payoutId)
      .maybeSingle();
    withdrawal = row ?? null;
  }

  if (!withdrawal && referenceId) {
    const { data: row } = await svc
      .from('withdrawals')
      .select('id, status')
      .or(`reference_id.eq.${referenceId},id.eq.${referenceId}`)
      .maybeSingle();
    withdrawal = row ?? null;
  }

  if (!withdrawal) {
    console.warn('Webhook payout tanpa baris withdrawals', { event, payoutId, referenceId });
    return json({ ok: true, ignored: true });
  }

  const eventId = [event || 'payout_event', payoutId ?? referenceId, status || 'unknown'].join(':');

  const { error: eventError } = await svc.from('withdrawal_events').insert({
    withdrawal_id: withdrawal.id,
    event_id: eventId,
    event_type: event || `v3_payout.${status.toLowerCase()}`,
    payload: body,
  });

  if (eventError) {
    if (eventError.code === '23505') return json({ ok: true, duplicate: true });
    console.error('Gagal menyimpan withdrawal event', eventError);
    return json({ error: 'Gagal menyimpan event' }, 500);
  }

  // Simpan payout id bila webhook tiba sebelum update dari request-withdrawal.
  if (payoutId) {
    await svc
      .from('withdrawals')
      .update({ xendit_payout_id: payoutId, updated_at: new Date().toISOString() })
      .eq('id', withdrawal.id)
      .is('xendit_payout_id', null);
  }

  const nextStatus = TERMINAL[event] ?? STATUS_MAP[status] ?? null;

  if (!nextStatus) {
    // pending / pending_compliance / processing — tidak perlu ubah status.
    return json({ ok: true, pending: true });
  }

  try {
    const { error } = await svc.rpc('settle_withdrawal', {
      p_withdrawal_id: withdrawal.id,
      p_status: nextStatus,
      p_failure_code:
        nextStatus === 'succeeded'
          ? null
          : (typeof data.failure_code === 'string' && data.failure_code) ||
            (typeof data.failure_reason === 'string' && data.failure_reason) ||
            'PAYOUT_FAILED',
    });
    if (error) throw new Error(error.message);
    return json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error('Gagal menyelesaikan pencairan', error);
    // 500 agar Xendit mengirim ulang webhook.
    return json({ error: 'Gagal memproses pencairan' }, 500);
  }
});
