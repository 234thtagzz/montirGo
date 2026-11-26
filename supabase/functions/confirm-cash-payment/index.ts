// MontirGo Edge Function: konfirmasi pembayaran tunai (cash) & catat komisi platform.
import { authenticate, cors, getServiceClient, isValidUuid, json } from '../_shared/http.ts';

interface Body {
  requestId?: string;
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
