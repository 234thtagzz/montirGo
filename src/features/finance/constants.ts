// Daftar bank & e-wallet tujuan pencairan.
// `code` disimpan di mechanic_payout_accounts.bank_code; Edge Function memetakan
// kode bank ke SWIFT/BIC saat mengirim payout ke Xendit.

import { Brand } from '@/constants/brand';

export interface PayoutChannel {
  code: string;
  label: string;
  short: string;
}

export const BANKS: PayoutChannel[] = [
  { code: 'BCA', label: 'Bank Central Asia (BCA)', short: 'BCA' },
  { code: 'BNI', label: 'Bank Negara Indonesia (BNI)', short: 'BNI' },
  { code: 'BRI', label: 'Bank Rakyat Indonesia (BRI)', short: 'BRI' },
  { code: 'MANDIRI', label: 'Bank Mandiri', short: 'Mandiri' },
  { code: 'PERMATA', label: 'Bank Permata', short: 'Permata' },
  { code: 'CIMB', label: 'CIMB Niaga', short: 'CIMB' },
  { code: 'BTN', label: 'Bank Tabungan Negara (BTN)', short: 'BTN' },
  { code: 'DANAMON', label: 'Bank Danamon', short: 'Danamon' },
  { code: 'BSI', label: 'Bank Syariah Indonesia (BSI)', short: 'BSI' },
  { code: 'OCBC', label: 'OCBC NISP', short: 'OCBC' },
  { code: 'PANIN', label: 'Panin Bank', short: 'Panin' },
  { code: 'MEGA', label: 'Bank Mega', short: 'Mega' },
  { code: 'BJB', label: 'Bank BJB', short: 'BJB' },
  { code: 'BUKOPIN', label: 'Bank Bukopin', short: 'Bukopin' },
  { code: 'MAYBANK', label: 'Maybank Indonesia', short: 'Maybank' },
  { code: 'JAGO', label: 'Bank Jago', short: 'Jago' },
];

export const EWALLETS: PayoutChannel[] = [
  { code: 'DANA', label: 'DANA', short: 'DANA' },
  { code: 'OVO', label: 'OVO', short: 'OVO' },
  { code: 'SHOPEEPAY', label: 'ShopeePay', short: 'ShopeePay' },
  { code: 'GOPAY', label: 'GoPay', short: 'GoPay' },
];

export function findChannel(code: string): PayoutChannel | undefined {
  return [...BANKS, ...EWALLETS].find((c) => c.code === code);
}

export function channelLabel(code: string | undefined | null): string {
  if (!code) return 'Rekening';
  const bank = BANKS.find((b) => b.code === code);
  if (bank) return bank.short;
  const wallet = EWALLETS.find((w) => w.code === code);
  if (wallet) return wallet.short;
  return code;
}

export function maskAccountNumber(value: string | undefined | null): string {
  if (!value) return '••••';
  const clean = value.replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  return `•••• ${clean.slice(-4)}`;
}

export interface WithdrawalStatusMeta {
  label: string;
  color: string;
  background: string;
}

export const WITHDRAWAL_STATUS_META: Record<string, WithdrawalStatusMeta> = {
  requested: { label: 'Menunggu', color: Brand.amber, background: Brand.amberSoft },
  processing: { label: 'Diproses', color: Brand.primary, background: Brand.primarySoft },
  succeeded: { label: 'Berhasil', color: Brand.green, background: Brand.greenSoft },
  failed: { label: 'Gagal', color: Brand.red, background: Brand.redSoft },
  cancelled: { label: 'Dibatalkan', color: Brand.textSecondary, background: Brand.divider },
};

export function withdrawalStatusMeta(status: string): WithdrawalStatusMeta {
  return (
    WITHDRAWAL_STATUS_META[status] ?? {
      label: status || 'Tidak diketahui',
      color: Brand.textSecondary,
      background: Brand.divider,
    }
  );
}

/** Fee platform yang ditampilkan ke montir (estimasi dari persen). */
export function estimateFee(gross: number, feePercent: number): number {
  return Math.round((gross * feePercent) / 100);
}
