// MontirGo Edge Function: konfirmasi pembayaran tunai (cash) & catat komisi platform.
// Dilengkapi anti-double-charge guard terhadap sesi Xendit yang sedang pending.
import {
  authenticate,
  cors,
  getServiceClient,
  isValidUuid,
  isXenditSessionCompleted,
  json,
  optionalEnv,
  xenditRequest,
} from '../_shared/xendit.ts';

interface Body {
  requestId?: string;
}

interface XenditSessionResponse {
  status?: string;
}

const ERROR_STATUS: Record<string, { status: number; message: string }> = {
  REQUEST_NOT_FOUND: { status: 404, message: 'Order tidak ditemukan.' },
  NOT_YOUR_ORDER: { status: 403, message: 'Order ini bukan ditangani olehmu.' },
  INVALID_STATUS: { status: 409, message: 'Order belum berada pada tahap pembayaran.' },
  PAYMENT_METHOD_NOT_CASH: {
    status: 409,
    message: 'Client belum memilih metode pembayaran tunai.',
  },
  INVALID_PRICE: { status: 400, message: 'Nominal tagihan order tidak valid.' },
  ALREADY_PAID: { status: 409, message: 'Order sudah lunas dibayar.' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  try {
    const { user } = await authenticate(req);
    const body = (await req.json().catch(() => null)) as Body | null;
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
    if (!isValidUuid(requestId)) {
      return json({ error: 'requestId tidak valid' }, 400);
    }

    const service = getServiceClient();

    // Anti-double-charge guard: sebelum mencatat pembayaran cash, pastikan tidak ada
    // sesi Xendit pending yang ternyata sudah COMPLETED di gateway.
    const { data: orderRow } = await service
      .from('service_requests')
      .select('id, mechanic_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (orderRow && orderRow.mechanic_id === user.id && orderRow.status === 'payment') {
      const { data: pendingPayment } = await service
        .from('payments')
        .select('id, payment_session_id')
        .eq('request_id', requestId)
        .eq('status', 'pending')
        .not('payment_session_id', 'is', null)
        .order('attempt_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      const sessionId =
        pendingPayment && typeof pendingPayment.payment_session_id === 'string'
          ? pendingPayment.payment_session_id.trim()
          : '';

      if (sessionId && optionalEnv('XENDIT_SECRET_KEY')) {
        const sessionRes = await xenditRequest<XenditSessionResponse>(
          `/sessions/${encodeURIComponent(sessionId)}`,
          { method: 'GET' },
        );

        if (!sessionRes.ok && sessionRes.status !== 404) {
          return json(
            {
              error:
                sessionRes.errorMessage ||
                'Gagal memverifikasi status pembayaran online di Xendit. Coba lagi.',
              code: 'XENDIT_VERIFY_FAILED',
            },
            502,
          );
        }

        if (sessionRes.ok && isXenditSessionCompleted(sessionRes.data?.status)) {
          const { error: finalizeError } = await service.rpc('finalize_payment', {
            p_payment_id: pendingPayment!.id,
          });
          if (finalizeError) {
            return json({ error: finalizeError.message }, 500);
          }
          return json(
            {
              error:
                'Client sudah melunasi pembayaran secara online. Pembayaran tunai dibatalkan untuk mencegah tagihan ganda.',
              code: 'ALREADY_PAID_ONLINE',
              finalizedOnline: true,
            },
            409,
          );
        }
      }
    }

    const { data, error } = await service.rpc('confirm_cash_payment', {
      p_request_id: requestId,
      p_mechanic_id: user.id,
    });

    if (error) {
      const code = error.message ?? '';
      const matched = Object.entries(ERROR_STATUS).find(([key]) => code.includes(key));
      if (matched) {
        return json({ error: matched[1].message, code: matched[0] }, matched[1].status);
      }
      return json({ error: error.message || 'Gagal mengonfirmasi pembayaran tunai.' }, 400);
    }

    return json({ payment: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengonfirmasi pembayaran tunai.';
    if (message === 'UNAUTHORIZED') return json({ error: 'Sesi berakhir. Login ulang.' }, 401);
    return json({ error: message }, 500);
  }
});
