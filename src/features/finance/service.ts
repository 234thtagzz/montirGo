// Data layer pembayaran & dompet montir.
// Semua angka saldo berasal dari database (RPC/trigger), bukan perhitungan lokal.
// Secret key Xendit hanya ada di Edge Function — aplikasi hanya memanggil function.

import { supabase } from '@/lib/supabase';
import type {
  FinanceSettings,
  MechanicWallet,
  OrderPayment,
  PaymentMethodChoice,
  PaymentSessionResult,
  PaymentSyncResult,
  PayoutAccount,
  PayoutAccountInput,
  Withdrawal,
} from './types';

export * from './types';

const DEFAULT_SETTINGS: FinanceSettings = {
  feePercent: 10,
  holdDays: 2,
  minWithdrawal: 50000,
  minOrderPrice: 10000,
  maxOrderPrice: 10000000,
};

async function getMyId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesi berakhir. Silakan login kembali.');
  return user.id;
}

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function|function .* does not exist/i.test(error.message ?? '')
  );
}

/** Ambil error body dari Edge Function agar pesannya informatif. */
async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: { json?: () => Promise<unknown> } })?.context;
  if (context?.json) {
    try {
      const body = (await context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // abaikan, pakai pesan bawaan
    }
  }
  if (error instanceof Error && error.message) {
    return error.message === 'Failed to send a request to the Edge Function'
      ? 'Tidak bisa menghubungi server pembayaran. Periksa koneksi.'
      : error.message;
  }
  return fallback;
}

/** Saldo dompet. Memicu pelepasan pendapatan yang sudah melewati masa hold. */
export async function getWallet(): Promise<MechanicWallet | null> {
  const { data, error } = await supabase.rpc('refresh_my_wallet');
  if (!error) {
    const row = (Array.isArray(data) ? data[0] : data) as MechanicWallet | null;
    return row ?? null;
  }

  if (!isMissingFunction(error)) throw new Error(error.message);

  // Fallback bila migrasi dompet belum dijalankan.
  const id = await getMyId();
  const { data: row, error: selectError } = await supabase
    .from('mechanic_wallets')
    .select('*')
    .eq('mechanic_id', id)
    .maybeSingle();
  if (selectError) return null;
  return (row as MechanicWallet | null) ?? null;
}

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value');
  if (error) return DEFAULT_SETTINGS;

  const map = new Map<string, string>();
  for (const row of (data ?? []) as { key: string; value: string }[]) {
    map.set(row.key, row.value);
  }
  const num = (key: string, fallback: number) => {
    const parsed = Number(map.get(key));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    feePercent: num('fee_percent', DEFAULT_SETTINGS.feePercent),
    holdDays: num('hold_days', DEFAULT_SETTINGS.holdDays),
    minWithdrawal: num('min_withdrawal', DEFAULT_SETTINGS.minWithdrawal),
    minOrderPrice: num('min_order_price', DEFAULT_SETTINGS.minOrderPrice),
    maxOrderPrice: num('max_order_price', DEFAULT_SETTINGS.maxOrderPrice),
  };
}

// ---------- Rekening pencairan ----------

export async function listPayoutAccounts(): Promise<PayoutAccount[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('mechanic_payout_accounts')
    .select('*')
    .eq('mechanic_id', id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PayoutAccount[];
}

export async function getPrimaryPayoutAccount(): Promise<PayoutAccount | null> {
  const accounts = await listPayoutAccounts();
  return accounts.find((a) => a.is_primary) ?? accounts[0] ?? null;
}

export async function createPayoutAccount(input: PayoutAccountInput): Promise<PayoutAccount> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('mechanic_payout_accounts')
    .insert({
      mechanic_id: id,
      type: input.type,
      bank_code: input.bank_code.toUpperCase(),
      account_number: input.account_number.replace(/\s+/g, ''),
      account_holder_name: input.account_holder_name.trim(),
      is_primary: input.is_primary ?? false,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as PayoutAccount;
}

export async function updatePayoutAccount(
  accountId: string,
  patch: Partial<PayoutAccountInput>,
): Promise<void> {
  const id = await getMyId();
  const normalized: Record<string, unknown> = {};
  if (patch.type) normalized.type = patch.type;
  if (patch.bank_code) normalized.bank_code = patch.bank_code.toUpperCase();
  if (patch.account_number) normalized.account_number = patch.account_number.replace(/\s+/g, '');
  if (patch.account_holder_name) normalized.account_holder_name = patch.account_holder_name.trim();
  if (typeof patch.is_primary === 'boolean') normalized.is_primary = patch.is_primary;

  const { error } = await supabase
    .from('mechanic_payout_accounts')
    .update(normalized)
    .eq('id', accountId)
    .eq('mechanic_id', id);
  if (error) throw new Error(error.message);
}

export async function setPrimaryPayoutAccount(accountId: string): Promise<void> {
  const id = await getMyId();
  // Lepas primary lama dulu agar unique index parsial tidak bentrok.
  const { error: clearError } = await supabase
    .from('mechanic_payout_accounts')
    .update({ is_primary: false })
    .eq('mechanic_id', id)
    .neq('id', accountId);
  if (clearError) throw new Error(clearError.message);

  const { error } = await supabase
    .from('mechanic_payout_accounts')
    .update({ is_primary: true })
    .eq('id', accountId)
    .eq('mechanic_id', id);
  if (error) throw new Error(error.message);
}

export async function deletePayoutAccount(accountId: string): Promise<void> {
  const id = await getMyId();
  const { error } = await supabase
    .from('mechanic_payout_accounts')
    .delete()
    .eq('id', accountId)
    .eq('mechanic_id', id);
  if (error) throw new Error(error.message);
}

// ---------- Pencairan ----------

export async function listWithdrawals(limit = 20): Promise<Withdrawal[]> {
  const id = await getMyId();
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('mechanic_id', id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Withdrawal[];
}

/**
 * Minta pencairan. RPC memotong saldo secara atomik, lalu Edge Function
 * mengirim payout ke Xendit. Bila Xendit gagal, saldo otomatis dikembalikan.
 */
export async function requestWithdrawal(
  amount: number,
  accountId: string,
): Promise<{ withdrawalId: string; payoutId: string; status: string }> {
  const { data, error } = await supabase.functions.invoke('xendit-request-withdrawal', {
    body: { amount, accountId },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Pencairan gagal diproses.'));
  const result = data as {
    withdrawalId?: string;
    payoutId?: string;
    status?: string;
    error?: string;
  };
  if (!result?.withdrawalId) {
    throw new Error(result?.error || 'Pencairan gagal diproses.');
  }
  return {
    withdrawalId: result.withdrawalId,
    payoutId: result.payoutId ?? '',
    status: result.status ?? 'processing',
  };
}

// ---------- Pembayaran order ----------

export async function getPaymentForRequest(requestId: string): Promise<OrderPayment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, request_id, amount, platform_fee, net_amount, method, status, payment_url, payment_session_id, expires_at, paid_at',
    )
    .eq('request_id', requestId)
    .maybeSingle();
  if (error) return null;
  return (data as OrderPayment | null) ?? null;
}

/** Terjemahkan kode error RPC pembayaran tunai menjadi pesan yang ramah. */
function cashErrorMessage(message: string | undefined): string {
  const code = message ?? '';
  if (code.includes('UNAUTHORIZED')) return 'Sesi berakhir. Silakan login kembali.';
  if (code.includes('REQUEST_NOT_FOUND')) return 'Order tidak ditemukan.';
  if (code.includes('NOT_YOUR_REQUEST')) return 'Order ini bukan milikmu.';
  if (code.includes('NOT_YOUR_ORDER')) return 'Order ini bukan milikmu.';
  if (code.includes('ALREADY_PAID')) return 'Order ini sudah lunas.';
  if (code.includes('INVALID_STATUS')) return 'Order ini tidak sedang menunggu pembayaran.';
  if (code.includes('INVALID_PRICE')) return 'Nominal tagihan belum diisi montir.';
  if (code.includes('INVALID_PAYMENT_METHOD')) return 'Metode pembayaran tidak dikenal.';
  if (code.includes('CASH_NOT_AVAILABLE')) return 'Pembayaran tunai belum tersedia.';
  return code || 'Pembayaran tunai gagal diproses.';
}

/**
 * Client memilih metode pembayaran (`online` lewat Xendit atau `cash` tunai
 * langsung ke montir). Server menyimpan pilihan di order agar montir tahu
 * bahwa client akan membayar tunai.
 */
export async function choosePaymentMethod(
  requestId: string,
  method: PaymentMethodChoice,
): Promise<void> {
  const { error } = await supabase.rpc('choose_payment_method', {
    p_request_id: requestId,
    p_method: method,
  });
  if (error) throw new Error(cashErrorMessage(error.message));
}

/**
 * Montir mengonfirmasi pembayaran tunai setelah uang benar-benar diterima.
 *
 * Server membuat/menandai `payments.method = 'cash'` dan mencatat `earnings`,
 * tetapi TIDAK menambah saldo dompet. Setelah ini order menjadi `paid`.
 */
export async function confirmCashPayment(requestId: string): Promise<OrderPayment> {
  const { data, error } = await supabase.rpc('confirm_cash_payment', {
    p_request_id: requestId,
  });
  if (error) throw new Error(cashErrorMessage(error.message));
  return data as OrderPayment;
}

/** Buat / pakai ulang sesi checkout Xendit, lalu buka URL-nya di browser. */
export async function createPaymentSession(requestId: string): Promise<PaymentSessionResult> {
  const { data, error } = await supabase.functions.invoke('xendit-create-payment', {
    body: { requestId },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Gagal membuat pembayaran.'));

  const result = data as PaymentSessionResult & { error?: string };
  if (result?.error && !result.paymentUrl) throw new Error(result.error);
  if (result?.alreadyPaid) return result;
  if (!result?.paymentUrl) throw new Error('Xendit tidak mengembalikan link pembayaran.');
  return result;
}

/**
 * Sinkronkan status pembayaran langsung ke Xendit.
 *
 * Webhook bisa telat / belum terdaftar, jadi layar client & montir memanggil
 * ini saat menampilkan order berstatus `payment`. Bila Xendit menyatakan
 * sesi sudah COMPLETED, Edge Function menjalankan `finalize_payment` sehingga
 * status order berubah menjadi `paid` untuk kedua pihak.
 */
export async function syncPaymentStatus(requestId: string): Promise<PaymentSyncResult> {
  const { data, error } = await supabase.functions.invoke('xendit-sync-payment', {
    body: { requestId },
  });
  if (error) {
    throw new Error(await functionErrorMessage(error, 'Gagal memeriksa status pembayaran.'));
  }

  const result = data as (PaymentSyncResult & { error?: string }) | null;
  if (!result) throw new Error('Server tidak mengembalikan status pembayaran.');
  if (result.error) throw new Error(result.error);
  return result;
}

/**
 * Sinkronkan semua order montir yang masih menunggu pembayaran.
 * Dipakai dashboard montir agar status "lunas" muncul walau webhook belum masuk.
 * Mengembalikan true bila ada order yang berubah menjadi lunas.
 */
export async function syncMechanicPendingPayments(
  orders: { id: string; status: string }[],
): Promise<boolean> {
  const pending = orders.filter((order) => order.status === 'payment').slice(0, 5);
  if (pending.length === 0) return false;

  const results = await Promise.allSettled(pending.map((order) => syncPaymentStatus(order.id)));
  return results.some(
    (result) => result.status === 'fulfilled' && result.value.status === 'paid',
  );
}
