// Tipe data dompet montir, rekening pencairan, dan pembayaran Xendit.

export type WithdrawalStatus = 'requested' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export type PayoutAccountType = 'bank' | 'ewallet';

export interface MechanicWallet {
  mechanic_id: string;
  /** Saldo yang sudah matang dan bisa ditarik. */
  available_balance: number;
  /** Pendapatan lunas yang masih menunggu masa hold/settlement. */
  pending_balance: number;
  /** Saldo yang sedang ditahan karena proses pencairan. */
  held_balance: number;
  total_earned: number;
  total_withdrawn: number;
  updated_at: string;
}

export interface PayoutAccount {
  id: string;
  mechanic_id: string;
  type: PayoutAccountType;
  bank_code: string;
  account_number: string;
  account_holder_name: string;
  routing_type: string | null;
  routing_value: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface PayoutAccountInput {
  type: PayoutAccountType;
  bank_code: string;
  account_number: string;
  account_holder_name: string;
  is_primary?: boolean;
}

export interface Withdrawal {
  id: string;
  mechanic_id: string;
  amount: number;
  fee: number;
  status: WithdrawalStatus;
  payout_account_id: string | null;
  account_snapshot: {
    bank_code?: string;
    account_number?: string;
    account_holder_name?: string;
    type?: string;
  } | null;
  xendit_payout_id: string | null;
  reference_id: string;
  failure_code: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface OrderPayment {
  id: string;
  request_id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  status: PaymentStatus;
  payment_url: string | null;
  payment_session_id: string | null;
  expires_at: string | null;
  paid_at: string | null;
}

export interface FinanceSettings {
  feePercent: number;
  holdDays: number;
  minWithdrawal: number;
  minOrderPrice: number;
  maxOrderPrice: number;
}

export interface PaymentSessionResult {
  paymentUrl: string;
  sessionId?: string | null;
  expiresAt?: string | null;
  amount: number;
  platformFee?: number;
  netAmount?: number;
  alreadyPaid?: boolean;
  message?: string;
  reused?: boolean;
}
