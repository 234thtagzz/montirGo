import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useToast } from '@/components/ui/toast';
import {
  getFinanceSettings,
  getWallet,
  listPayoutAccounts,
  listWithdrawals,
  requestWithdrawal,
  syncWithdrawalStatus,
  type FinanceSettings,
  type MechanicWallet,
  type PayoutAccount,
  type Withdrawal,
} from '@/features/finance/service';
import { formatIDR } from '@/utils/format';

const DEFAULT_SETTINGS: FinanceSettings = {
  feePercent: 10,
  holdDays: 2,
  minWithdrawal: 50000,
  minOrderPrice: 10000,
  maxOrderPrice: 10000000,
  maxCashCommissionDebt: 100000,
};

const QUICK_RATIOS = [0.25, 0.5, 0.75, 1] as const;

export function useWithdraw() {
  const { showToast } = useToast();

  const [wallet, setWallet] = useState<MechanicWallet | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncingWithdrawalId, setSyncingWithdrawalId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, a, s, history] = await Promise.all([
        getWallet(),
        listPayoutAccounts(),
        getFinanceSettings(),
        listWithdrawals(10),
      ]);
      setWallet(w);
      setAccounts(a);
      setSettings(s);
      setWithdrawals(history);
      setSelectedAccountId((current) => {
        if (current && a.some((item) => item.id === current)) return current;
        return (a.find((item) => item.is_primary) ?? a[0])?.id ?? null;
      });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const available = wallet?.available_balance ?? 0;
  const commissionDebt = wallet?.commission_debt ?? 0;
  const amount = useMemo(
    () => Number(amountText.replace(/[^0-9]/g, '')) || 0,
    [amountText],
  );
  const selectedAccount =
    accounts.find((item) => item.id === selectedAccountId) ?? null;
  const hasActive = withdrawals.some(
    (item) => item.status === 'requested' || item.status === 'processing',
  );

  const quickAmounts = useMemo(
    () =>
      QUICK_RATIOS.map((ratio) => ({
        ratio,
        label: ratio === 1 ? 'Semua' : `${Math.round(ratio * 100)}%`,
        value: ratio === 1 ? available : Math.floor(available * ratio),
      })).filter((item) => item.value > 0),
    [available],
  );

  const validation = (() => {
    if (amount <= 0) return null;
    if (amount < settings.minWithdrawal) {
      return `Minimal pencairan ${formatIDR(settings.minWithdrawal)}.`;
    }
    if (amount > available) return 'Nominal melebihi saldo yang bisa ditarik.';
    return null;
  })();

  const canSubmit =
    !submitting &&
    !hasActive &&
    commissionDebt <= 0 &&
    amount > 0 &&
    !validation &&
    Boolean(selectedAccount);

  const handleSyncWithdrawal = async (withdrawalId: string) => {
    setSyncingWithdrawalId(withdrawalId);
    try {
      await syncWithdrawalStatus(withdrawalId);
      await load();
      showToast({ tone: 'info', message: 'Status pencairan diperbarui.' });
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal sinkronisasi',
        message: e instanceof Error ? e.message : 'Coba lagi beberapa saat.',
      });
    } finally {
      setSyncingWithdrawalId(null);
    }
  };

  const submit = async () => {
    if (!canSubmit || !selectedAccount) return;
    setSubmitting(true);
    try {
      await requestWithdrawal(amount, selectedAccount.id);
      setConfirmOpen(false);
      setSuccessAmount(amount);
      setAmountText('');
      await load();
      showToast({
        tone: 'success',
        title: 'Pencairan diajukan',
        message: `${formatIDR(amount)} sedang diproses ke rekening tujuan.`,
      });
    } catch (e) {
      setConfirmOpen(false);
      showToast({
        tone: 'danger',
        title: 'Pencairan gagal',
        message: e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    wallet,
    accounts,
    withdrawals,
    settings,
    selectedAccountId,
    setSelectedAccountId,
    selectedAccount,
    amountText,
    setAmountText,
    amount,
    available,
    commissionDebt,
    hasActive,
    quickAmounts,
    validation,
    canSubmit,
    confirmOpen,
    setConfirmOpen,
    successAmount,
    setSuccessAmount,
    loading,
    refreshing,
    setRefreshing,
    submitting,
    syncingWithdrawalId,
    error,
    load,
    handleSyncWithdrawal,
    submit,
  };
}
