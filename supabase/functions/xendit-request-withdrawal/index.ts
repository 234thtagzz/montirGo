// Supabase Edge Function: xendit-request-withdrawal
// Montir meminta pencairan saldo -> RPC atomik -> Xendit Payouts v3.
// Deploy: supabase functions deploy xendit-request-withdrawal
// Secrets: XENDIT_SECRET_KEY, XENDIT_COMPANY_ADDRESS/CITY/PROVINCE/POSTAL_CODE (opsional)

import {
  authenticate,
  friendlyXenditError,
  getServiceClient,
  json,
  xenditRequest,
} from '../_shared/xendit.ts';

interface Body {
  amount?: unknown;
  accountId?: unknown;
}

interface WithdrawalRow {
  id: string;
  amount: number;
  fee: number;
  reference_id: string;
  account_snapshot: {
    type?: string;
    bank_code?: string;
    account_number?: string;
    account_holder_name?: string;
    routing_type?: string | null;
    routing_value?: string | null;
  };
}

interface XenditPayout {
  payout_id?: string;
  status?: string;
  failure_code?: string;
}

// Xendit v3 memakai SWIFT/BIC untuk bank lokal. Daftar ini diambil dari
// GET /v3/payouts/channels (channel_identifiers) dan hanya memuat bank yang
// didukung di aplikasi. Nilai bisa dioverride lewat kolom routing_type/
// routing_value di mechanic_payout_accounts.
// Contoh: BCA memakai CENAIDJA (bukan BCAIDJA).
const SWIFT_BY_BANK: Record<string, string> = {
  BCA: 'CENAIDJA',
  BNI: 'BNINIDJA',
  BRI: 'BRINIDJA',
  MANDIRI: 'BMRIIDJA',
  PERMATA: 'BBBAIDJA',
  CIMB: 'BNIAIDJA',
  BTN: 'BTANIDJA',
  DANAMON: 'BDINIDJA',
  BSI: 'BSMDIDJA',
  OCBC: 'OCBCIDJA',
  PANIN: 'PINBIDJA',
  MEGA: 'MEGAIDJA',
  BJB: 'BJBJIDJA',
  BUKOPIN: 'BBUKIDJA',
  MAYBANK: 'IBBKIDJA',
  JAGO: 'JAGBIDJA',
};

const RPC_MESSAGES: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Saldo yang bisa ditarik belum cukup.',
  MIN_WITHDRAWAL: 'Nominal di bawah batas minimum pencairan.',
  ACTIVE_WITHDRAWAL_EXISTS: 'Masih ada pencairan yang sedang diproses.',
  INVALID_ACCOUNT: 'Rekening tujuan tidak ditemukan.',
  INVALID_STATUS: 'Status pencairan tidak valid.',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  if (req.method !== 'POST') return json({ error: 'Metode tidak didukung' }, 405);

  try {
    const { sb } = await authenticate(req);
    const body = (await req.json().catch(() => null)) as Body | null;
    const amount = Math.round(Number(body?.amount ?? 0));
    const accountId = typeof body?.accountId === 'string' ? body.accountId : '';

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: 'Nominal pencairan tidak valid' }, 400);
    }
    if (!accountId) return json({ error: 'Pilih rekening tujuan' }, 400);

    const { data, error } = await sb.rpc('request_withdrawal', {
      p_amount: amount,
      p_account_id: accountId,
    });

    if (error) {
      const code = (error.message ?? '').trim();
      const friendly = RPC_MESSAGES[code];
      const status = code === 'UNAUTHORIZED' ? 401 : 409;
      return json({ error: friendly ?? code ?? 'Gagal membuat permintaan pencairan' }, status);
    }

    const raw = data as WithdrawalRow | WithdrawalRow[] | null;
    const withdrawal = Array.isArray(raw) ? raw[0] : raw;
    if (!withdrawal?.id) {
      return json({ error: 'Permintaan pencairan tidak terbentuk' }, 500);
    }

    const account = withdrawal.account_snapshot ?? {};
    const payout = await xenditRequest<XenditPayout>('/v3/payouts', {
      apiVersion: '2025-09-01',
      idempotencyKey: withdrawal.id,
      body: buildPayoutPayload(withdrawal, account),
    });

    if (!payout.ok || !payout.data?.payout_id) {
      const svc = getServiceClient();
      await svc.rpc('settle_withdrawal', {
        p_withdrawal_id: withdrawal.id,
        p_status: 'failed',
        p_failure_code: payout.errorCode ?? 'PAYOUT_REQUEST_FAILED',
      });

      return json(
        {
          error: friendlyXenditError(
            payout.errorCode,
            payout.message,
            'Pencairan gagal diproses. Saldo dikembalikan.',
          ),
          code: payout.errorCode,
        },
        502,
      );
    }

    const svc = getServiceClient();
    const { error: updateError } = await svc
      .from('withdrawals')
      .update({
        status: 'processing',
        xendit_payout_id: payout.data.payout_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', withdrawal.id);

    if (updateError) {
      // Payout sudah dibuat; jangan refund. Biarkan rekonsiliasi webhook
      // yang memperbaiki status.
      console.error('Payout dibuat tetapi gagal update status', updateError);
    }

    return json({
      ok: true,
      withdrawalId: withdrawal.id,
      payoutId: payout.data.payout_id,
      status: payout.data.status ?? 'ACCEPTED',
      amount: withdrawal.amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan';
    if (message === 'UNAUTHORIZED') return json({ error: 'Sesi berakhir. Login ulang.' }, 401);
    console.error('Gagal request withdrawal', error);
    return json({ error: message }, 500);
  }
});

function buildPayoutPayload(
  withdrawal: WithdrawalRow,
  account: WithdrawalRow['account_snapshot'],
) {
  const holder = (account.account_holder_name ?? '').trim();
  const [firstName, ...rest] = holder.split(/\s+/);
  const isWallet = account.type === 'ewallet';

  const accountDetails: Record<string, unknown> = {
    currency: 'IDR',
    account_country: 'ID',
    account_holder_name: holder,
    account_number: account.account_number,
  };

  if (isWallet) {
    accountDetails.routing_type_1 = 'WALLET';
    accountDetails.routing_value_1 = account.routing_value ||
      (account.bank_code?.startsWith('ID_') ? account.bank_code : `ID_${account.bank_code ?? ''}`);
  } else {
    accountDetails.routing_type_1 = account.routing_type || 'SWIFT';
    accountDetails.routing_value_1 = account.routing_value ||
      SWIFT_BY_BANK[account.bank_code ?? ''] ||
      account.bank_code;
    accountDetails.account_type = 'SAVINGS';
  }

  return {
    reference_id: withdrawal.id,
    recipient: {
      // Xendit v3 (api-version 2025-09-01) memvalidasi `customer_type`
      // walaupun dokumentasi hanya menampilkan `type`. Kirim keduanya.
      type: 'INDIVIDUAL',
      customer_type: 'INDIVIDUAL',
      given_name: (firstName || holder || 'Montir').slice(0, 50),
      ...(rest.length > 0 ? { surname: rest.join(' ').slice(0, 50) } : {}),
      relationship: 'SUPPLIER',
      account_details: accountDetails,
      address: {
        country: 'ID',
        street_line_1: Deno.env.get('XENDIT_COMPANY_ADDRESS') ?? 'Jl. Jenderal Sudirman',
        city: Deno.env.get('XENDIT_COMPANY_CITY') ?? 'Jakarta',
        province_state: Deno.env.get('XENDIT_COMPANY_PROVINCE') ?? 'DKI Jakarta',
        postal_code: Deno.env.get('XENDIT_COMPANY_POSTAL_CODE') ?? '12190',
      },
    },
    payout_details: {
      source_currency: 'IDR',
      source_amount: withdrawal.amount,
      destination_currency: 'IDR',
    },
    source_of_fund: 'BUSINESS_REVENUE',
    purpose_code: 'OTHER',
    description: `MontirGo ${withdrawal.id.slice(0, 8).toUpperCase()}`,
    metadata: {
      withdrawal_id: withdrawal.id,
      mechanic_payout: true,
    },
  };
}
