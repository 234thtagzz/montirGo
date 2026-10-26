// Supabase Edge Function: xendit-sync-payment
// Deploy: supabase functions deploy xendit-sync-payment
// Secrets: XENDIT_SECRET_KEY
//
// Fallback ketika webhook Xendit belum/tidak masuk (URL belum didaftarkan,
// token salah, atau notifikasi telat). Aplikasi memanggil function ini saat
// layar pembayaran dibuka / setelah kembali dari checkout:
//
//   GET /sessions/{payment_session_id}
//     -> status COMPLETED? finalize_payment(payment_id)
//     -> status EXPIRED?   tandai payments.expired
//
// Status TIDAK pernah diambil dari aplikasi mobile — selalu dari Xendit.

import {
  authenticate,
  cors,
  getServiceClient,
  json,
  xenditRequest,
} from '../_shared/xendit.ts';

interface Body {
  requestId?: unknown;
}

interface XenditSession {
  payment_session_id?: string;
  status?: string;
  payment_id?: string;
  payment_request_id?: string;
  latest_payment_request_id?: string;
  expires_at?: string;
}

interface PaymentRow {
  id: string;
  request_id: string;
  status: string;
  payment_session_id: string | null;
  external_payment_id: string | null;
  paid_at: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  try {
    const { user } = await authenticate(req);
    const body = (await req.json().catch(() => null)) as Body | null;
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
    if (!requestId) return json({ error: 'requestId wajib diisi' }, 400);

    const svc = getServiceClient();

    const { data: requestRow, error: requestError } = await svc
      .from('service_requests')
      .select('id, client_id, mechanic_id, status')
      .eq('id', requestId)
      .maybeSingle();

    if (requestError) return json({ error: requestError.message }, 400);
    if (!requestRow) return json({ error: 'Order tidak ditemukan' }, 404);
    if (requestRow.client_id !== user.id && requestRow.mechanic_id !== user.id) {
      return json({ error: 'Kamu tidak berhak memeriksa pembayaran order ini' }, 403);
    }

    // Order sudah lunas — tidak perlu memanggil Xendit lagi.
    if (requestRow.status === 'paid') {
      return json({ status: 'paid', orderStatus: 'paid', alreadyPaid: true });
    }

    const { data: paymentData, error: paymentError } = await svc
      .from('payments')
      .select(
        'id, request_id, status, payment_session_id, external_payment_id, paid_at',
      )
      .eq('request_id', requestId)
      .maybeSingle();

    if (paymentError) return json({ error: paymentError.message }, 400);

    const payment = paymentData as PaymentRow | null;
    if (!payment) {
      return json({ status: 'none', orderStatus: requestRow.status });
    }
    if (payment.status === 'paid') {
      return json({
        status: 'paid',
        orderStatus: requestRow.status,
        paidAt: payment.paid_at,
      });
    }
    if (!payment.payment_session_id) {
      return json({ status: payment.status, orderStatus: requestRow.status });
    }

    const result = await xenditRequest<XenditSession>(
      `/sessions/${encodeURIComponent(payment.payment_session_id)}`,
      { method: 'GET' },
    );

    if (!result.ok || !result.data) {
      // 404 dari Xendit: sesi tidak dikenal — biarkan status apa adanya.
      if (result.status === 404) {
        return json({ status: payment.status, orderStatus: requestRow.status });
      }
      return json(
        {
          error: result.message || 'Gagal memeriksa status pembayaran ke Xendit.',
          code: result.errorCode,
        },
        502,
      );
    }

    const session = result.data;
    const sessionStatus = String(session.status ?? '').toUpperCase();
    const externalPaymentId = session.payment_id ?? session.payment_request_id ?? null;

    if (externalPaymentId && externalPaymentId !== payment.external_payment_id) {
      await svc
        .from('payments')
        .update({
          external_payment_id: externalPaymentId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
    }

    if (sessionStatus === 'COMPLETED') {
      const { error: finalizeError } = await svc.rpc('finalize_payment', {
        p_payment_id: payment.id,
      });
      if (finalizeError) {
        console.error('finalize_payment gagal dari sync', finalizeError);
        return json(
          {
            error:
              finalizeError.code === 'PGRST202' || finalizeError.code === '42883'
                ? 'Fungsi finalize_payment belum tersedia. Jalankan migrasi pembayaran.'
                : finalizeError.message,
          },
          500,
        );
      }

      const { data: fresh } = await svc
        .from('payments')
        .select('status, paid_at')
        .eq('id', payment.id)
        .maybeSingle();

      return json({
        status: fresh?.status ?? 'paid',
        orderStatus: 'paid',
        paidAt: fresh?.paid_at ?? null,
        finalized: true,
      });
    }

    if (sessionStatus === 'EXPIRED' || sessionStatus === 'CANCELED') {
      await svc
        .from('payments')
        .update({
          status: sessionStatus === 'EXPIRED' ? 'expired' : 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .neq('status', 'paid');

      return json({
        status: sessionStatus === 'EXPIRED' ? 'expired' : 'failed',
        orderStatus: requestRow.status,
      });
    }

    return json({
      status: payment.status,
      orderStatus: requestRow.status,
      sessionStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
    if (message === 'UNAUTHORIZED') return json({ error: 'Sesi berakhir. Login ulang.' }, 401);
    if (message.startsWith('Konfigurasi server belum lengkap')) {
      return json({ error: message }, 500);
    }
    console.error('xendit-sync-payment error', error);
    return json({ error: message }, 500);
  }
});
