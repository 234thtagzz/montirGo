// Supabase Edge Function: xendit-create-payment
// Membuat Xendit Payment Session (hosted checkout: QRIS, e-wallet, VA).
// Deploy: supabase functions deploy xendit-create-payment
// Secrets: XENDIT_SECRET_KEY, PLATFORM_FEE_PERCENT (opsional, fallback tabel platform_settings)

import {
  authenticate,
  cors,
  getServiceClient,
  json,
  parseFeePercent,
  xenditRequest,
} from '../_shared/xendit.ts';

interface Body {
  requestId?: unknown;
}

interface XenditSession {
  payment_session_id?: string;
  payment_link_url?: string;
  expires_at?: string;
  status?: string;
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
      .select('id, client_id, mechanic_id, status, price_amount, currency')
      .eq('id', requestId)
      .maybeSingle();

    if (requestError) return json({ error: requestError.message }, 400);
    if (!requestRow) return json({ error: 'Order tidak ditemukan' }, 404);
    if (requestRow.client_id !== user.id) {
      return json({ error: 'Order ini bukan milikmu' }, 403);
    }
    if (requestRow.status === 'paid') {
      return json({ alreadyPaid: true, message: 'Order sudah lunas.' });
    }
    if (requestRow.status !== 'payment') {
      return json({ error: 'Order belum siap dibayar. Tunggu tagihan dari montir.' }, 409);
    }
    if (!requestRow.mechanic_id) {
      return json({ error: 'Order belum memiliki montir.' }, 409);
    }

    const amount = Number(requestRow.price_amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: 'Nominal tagihan belum diisi montir.' }, 409);
    }

    const { data: feeSetting } = await svc
      .from('platform_settings')
      .select('value')
      .eq('key', 'fee_percent')
      .maybeSingle();

    const envFeeRaw = Deno.env.get('PLATFORM_FEE_PERCENT');
    const feePercent = parseFeePercent(envFeeRaw?.trim() ? envFeeRaw : feeSetting?.value, 10);
    const platformFee = Math.round((amount * feePercent) / 100);
    const netAmount = amount - platformFee;

    const { data: paidRow } = await svc
      .from('payments')
      .select('id')
      .eq('request_id', requestId)
      .eq('status', 'paid')
      .maybeSingle();

    if (paidRow) {
      return json({ alreadyPaid: true, message: 'Order sudah lunas.' });
    }

    const { data: existingPending } = await svc
      .from('payments')
      .select('id, amount, status, payment_url, expires_at, payment_session_id')
      .eq('request_id', requestId)
      .eq('status', 'pending')
      .maybeSingle();

    if (
      existingPending &&
      Number(existingPending.amount) === amount &&
      existingPending.payment_url &&
      existingPending.expires_at &&
      new Date(existingPending.expires_at).getTime() > Date.now() + 60_000
    ) {
      return json({
        paymentUrl: existingPending.payment_url,
        sessionId: existingPending.payment_session_id,
        expiresAt: existingPending.expires_at,
        amount,
        reused: true,
      });
    }

    // Jika pending sebelumnya memiliki nominal berbeda (revisi invoice) atau hampir kedaluwarsa, tutup dulu.
    if (existingPending) {
      await svc
        .from('payments')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', existingPending.id)
        .eq('status', 'pending');
    }

    const { data: lastAttempt } = await svc
      .from('payments')
      .select('attempt_no')
      .eq('request_id', requestId)
      .order('attempt_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    const attemptNo = Number(lastAttempt?.attempt_no ?? 0) + 1;
    const paymentId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error: reserveError } = await svc.from('payments').insert({
      id: paymentId,
      request_id: requestId,
      attempt_no: attemptNo,
      amount,
      platform_fee: platformFee,
      net_amount: netAmount,
      fee_percent: feePercent,
      currency: requestRow.currency ?? 'IDR',
      method: 'other',
      status: 'pending',
      expires_at: expiresAt,
    });

    if (reserveError) {
      if (reserveError.code === '23505') {
        const { data: raced } = await svc
          .from('payments')
          .select('amount, payment_url, payment_session_id, expires_at')
          .eq('request_id', requestId)
          .eq('status', 'pending')
          .maybeSingle();
        if (raced?.payment_url) {
          return json({
            paymentUrl: raced.payment_url,
            sessionId: raced.payment_session_id,
            expiresAt: raced.expires_at,
            amount: raced.amount,
            reused: true,
          });
        }
        return json({ error: 'Sesi pembayaran lain sedang dibuat. Coba lagi sebentar.' }, 409);
      }
      return json({ error: reserveError.message }, 500);
    }

    const payload: Record<string, unknown> = {
      reference_id: paymentId,
      session_type: 'PAY',
      mode: 'PAYMENT_LINK',
      amount,
      currency: 'IDR',
      country: 'ID',
      allowed_payment_channels: ['QRIS', 'DANA', 'OVO', 'SHOPEEPAY', 'GOPAY'],
      expires_at: expiresAt,
      locale: 'id',
      description: `MontirGo order #${requestId.slice(0, 8).toUpperCase()}`,
      metadata: {
        request_id: requestId,
        payment_id: paymentId,
        attempt_no: attemptNo,
        mechanic_id: requestRow.mechanic_id,
        client_id: user.id,
      },
    };

    const returnUrl = Deno.env.get('APP_PAYMENT_RETURN_URL');
    if (returnUrl?.startsWith('https://')) {
      payload.success_return_url = returnUrl;
      payload.cancel_return_url = returnUrl;
    }

    const result = await xenditRequest<XenditSession>('/sessions', {
      body: payload,
      idempotencyKey: paymentId,
    });
    if (!result.ok || !result.data) {
      await svc
        .from('payments')
        .update({
          status: result.isAmbiguous ? 'expired' : 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .eq('status', 'pending');

      return json(
        {
          error: result.errorMessage || 'Gagal membuat pembayaran Xendit.',
          code: result.errorCode,
        },
        502,
      );
    }

    const paymentUrl = result.data.payment_link_url;
    const sessionId = result.data.payment_session_id;
    if (!paymentUrl || !sessionId) {
      await svc
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', paymentId)
        .eq('status', 'pending');
      return json({ error: 'Xendit tidak mengembalikan link pembayaran.' }, 502);
    }

    const { error: updateError } = await svc
      .from('payments')
      .update({
        gateway_reference: sessionId,
        payment_session_id: sessionId,
        payment_url: paymentUrl,
        expires_at: result.data.expires_at ?? expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (updateError) return json({ error: updateError.message }, 500);

    return json({
      paymentUrl,
      sessionId,
      expiresAt: result.data.expires_at ?? expiresAt,
      amount,
      platformFee,
      netAmount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
    if (message === 'UNAUTHORIZED') return json({ error: 'Sesi berakhir. Login ulang.' }, 401);
    return json({ error: message }, 500);
  }
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
