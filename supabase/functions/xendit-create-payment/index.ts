// Supabase Edge Function: xendit-create-payment
// Membuat Xendit Payment Session (hosted checkout: QRIS, e-wallet, VA).
// Deploy: supabase functions deploy xendit-create-payment
// Secrets: XENDIT_SECRET_KEY, PLATFORM_FEE_PERCENT (opsional, fallback tabel platform_settings)

import { cors, getServiceClient, json, xenditRequest, authenticate } from '../_shared/xendit.ts';

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

    const envFee = Number(Deno.env.get('PLATFORM_FEE_PERCENT') ?? '');
    const feeFromDb = Number(feeSetting?.value ?? '');
    const feePercent = clamp(
      Number.isFinite(envFee) && envFee > 0 ? envFee : Number.isFinite(feeFromDb) ? feeFromDb : 10,
      0,
      50,
    );
    const platformFee = Math.round((amount * feePercent) / 100);
    const netAmount = amount - platformFee;

    const { data: existing } = await svc
      .from('payments')
      .select('id, status, payment_url, expires_at, payment_session_id')
      .eq('request_id', requestId)
      .maybeSingle();

    if (existing?.status === 'paid') {
      return json({ alreadyPaid: true, message: 'Order sudah lunas.' });
    }

    if (
      existing?.status === 'pending' &&
      existing.payment_url &&
      existing.expires_at &&
      new Date(existing.expires_at).getTime() > Date.now() + 60_000
    ) {
      return json({
        paymentUrl: existing.payment_url,
        sessionId: existing.payment_session_id,
        expiresAt: existing.expires_at,
        amount,
        reused: true,
      });
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const payload: Record<string, unknown> = {
      reference_id: requestId,
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
        mechanic_id: requestRow.mechanic_id,
        client_id: user.id,
      },
    };

    // Xendit mewajibkan return URL HTTPS. Bila belum ada domain, biarkan kosong
    // dan pengguna kembali manual dari halaman checkout.
    const returnUrl = Deno.env.get('APP_PAYMENT_RETURN_URL');
    if (returnUrl?.startsWith('https://')) {
      payload.success_return_url = returnUrl;
      payload.cancel_return_url = returnUrl;
    }

    const result = await xenditRequest<XenditSession>('/sessions', { body: payload });
    if (!result.ok || !result.data) {
      return json(
        {
          error: result.message || 'Gagal membuat pembayaran Xendit.',
          code: result.errorCode,
        },
        502,
      );
    }

    const paymentUrl = result.data.payment_link_url;
    const sessionId = result.data.payment_session_id;
    if (!paymentUrl || !sessionId) {
      return json({ error: 'Xendit tidak mengembalikan link pembayaran.' }, 502);
    }

    const { error: upsertError } = await svc.from('payments').upsert(
      {
        request_id: requestId,
        amount,
        platform_fee: platformFee,
        net_amount: netAmount,
        fee_percent: feePercent,
        currency: requestRow.currency ?? 'IDR',
        method: 'other',
        status: 'pending',
        gateway_reference: sessionId,
        payment_session_id: sessionId,
        payment_url: paymentUrl,
        qr_payload: null,
        expires_at: result.data.expires_at ?? expiresAt,
        paid_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'request_id' },
    );

    if (upsertError) return json({ error: upsertError.message }, 500);

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
