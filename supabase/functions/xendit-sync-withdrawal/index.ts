// MontirGo Edge Function: sinkronisasi status pencairan dana (withdrawal) ke Xendit.
import {
  authenticate,
  cors,
  getServiceClient,
  isValidUuid,
  json,
  xenditRequest,
} from '../_shared/xendit.ts';

interface Body {
  withdrawalId?: string;
}

interface XenditPayout {
  payout_id?: string;
  id?: string;
  status?: string;
  failure_code?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  try {
    const { user } = await authenticate(req);
    const body = (await req.json().catch(() => null)) as Body | null;
    const withdrawalId =
      typeof body?.withdrawalId === 'string' ? body.withdrawalId.trim() : '';

    if (!isValidUuid(withdrawalId)) {
      return json({ error: 'withdrawalId tidak valid' }, 400);
    }

    const service = getServiceClient();
    const { data: withdrawal, error: wdError } = await service
      .from('withdrawals')
      .select('id, mechanic_id, status, xendit_payout_id, failure_code')
      .eq('id', withdrawalId)
      .maybeSingle();

    if (wdError) return json({ error: wdError.message }, 400);
    if (!withdrawal) return json({ error: 'Pencairan tidak ditemukan' }, 404);
    if (withdrawal.mechanic_id !== user.id) {
      return json({ error: 'Kamu tidak berhak memeriksa pencairan ini' }, 403);
    }

    if (['succeeded', 'failed', 'cancelled'].includes(withdrawal.status)) {
      return json({ status: withdrawal.status, settled: true });
    }

    if (!withdrawal.xendit_payout_id) {
      return json({ status: withdrawal.status, settled: false });
    }

    const res = await xenditRequest<XenditPayout>(
      `/v3/payouts/${encodeURIComponent(withdrawal.xendit_payout_id)}`,
    );

    if (!res.ok || !res.data) {
      return json({
        status: withdrawal.status,
        settled: false,
        warning: res.errorMessage ?? 'Belum bisa mengambil status dari Xendit.',
      });
    }

    const rawStatus = (res.data.status ?? '').toUpperCase();
    let nextStatus: 'succeeded' | 'failed' | 'cancelled' | null = null;
    if (rawStatus === 'SUCCEEDED') nextStatus = 'succeeded';
    else if (rawStatus === 'FAILED' || rawStatus === 'REVERSED') nextStatus = 'failed';
    else if (rawStatus === 'CANCELLED') nextStatus = 'cancelled';

    if (!nextStatus) {
      return json({ status: withdrawal.status, xenditStatus: rawStatus, settled: false });
    }

    const { error: settleError } = await service.rpc('settle_withdrawal', {
      p_withdrawal_id: withdrawal.id,
      p_status: nextStatus,
      p_failure_code: res.data.failure_code ?? null,
    });
    if (settleError) {
      return json({ error: settleError.message }, 500);
    }

    return json({ status: nextStatus, xenditStatus: rawStatus, settled: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal sinkronisasi status pencairan.';
    if (message === 'UNAUTHORIZED') return json({ error: 'Sesi berakhir. Login ulang.' }, 401);
    return json({ error: message }, 500);
  }
});
