import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, CardShadow, Radius, ScreenPadding, Space } from '@/constants/brand';
import {
  channelLabel,
  maskAccountNumber,
  withdrawalStatusMeta,
} from '@/features/finance/constants';
import {
  getFinanceSettings,
  getWallet,
  listPayoutAccounts,
  listWithdrawals,
  requestWithdrawal,
  type FinanceSettings,
  type MechanicWallet,
  type PayoutAccount,
  type Withdrawal,
} from '@/features/finance/service';
import { formatDateTime, formatIDR } from '@/utils/format';

const DEFAULT_SETTINGS: FinanceSettings = {
  feePercent: 10,
  holdDays: 2,
  minWithdrawal: 50000,
  minOrderPrice: 10000,
  maxOrderPrice: 10000000,
};

export default function WithdrawScreen() {
  const router = useRouter();

  const [wallet, setWallet] = useState<MechanicWallet | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
      load();
    }, [load]),
  );

  const available = wallet?.available_balance ?? 0;
  const amount = useMemo(() => Number(amountText.replace(/[^0-9]/g, '')) || 0, [amountText]);
  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) ?? null;
  const hasActive = withdrawals.some(
    (item) => item.status === 'requested' || item.status === 'processing',
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
    amount > 0 &&
    !validation &&
    Boolean(selectedAccount);

  const submit = () => {
    if (!canSubmit || !selectedAccount) return;
    Alert.alert(
      'Konfirmasi pencairan',
      `Tarik ${formatIDR(amount)} ke ${channelLabel(selectedAccount.bank_code)} ${maskAccountNumber(
        selectedAccount.account_number,
      )}? Saldo langsung ditahan sampai pencairan selesai.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tarik sekarang',
          onPress: async () => {
            setSubmitting(true);
            try {
              await requestWithdrawal(amount, selectedAccount.id);
              setAmountText('');
              await load();
              Alert.alert(
                'Pencairan diproses',
                'Dana sedang dikirim ke rekening tujuan. Status akan diperbarui otomatis.',
              );
            } catch (e) {
              Alert.alert(
                'Pencairan gagal',
                e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.',
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Tarik Saldo" />
        <LoadingState message="Memuat saldo..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Tarik Saldo" />
        <ErrorState onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Tarik Saldo" subtitle="Pencairan via Xendit" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={Brand.primary}
              colors={[Brand.primary]}
            />
          }
        >
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Saldo bisa ditarik</Text>
            <Text style={styles.balanceValue}>{formatIDR(available)}</Text>
            <View style={styles.balanceMeta}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  Menunggu · {formatIDR(wallet?.pending_balance ?? 0)}
                </Text>
              </View>
              {wallet?.held_balance ? (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    Ditahan · {formatIDR(wallet.held_balance)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.section}>Nominal pencairan</Text>
          <View style={styles.amountCard}>
            <Text style={styles.currency}>Rp</Text>
            <TextInput
              value={amountText ? amount.toLocaleString('id-ID') : ''}
              onChangeText={(text) => setAmountText(text.replace(/[^0-9]/g, ''))}
              placeholder="0"
              placeholderTextColor={Brand.textMuted}
              keyboardType="number-pad"
              selectionColor={Brand.primary}
              style={styles.amountInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Isi semua saldo"
              onPress={() => setAmountText(String(available))}
              style={({ pressed }) => [styles.allButton, pressed && styles.pressed]}
            >
              <Text style={styles.allButtonText}>Semua</Text>
            </Pressable>
          </View>
          {validation ? <Text style={styles.validation}>{validation}</Text> : null}
          <Text style={styles.helper}>
            Minimal {formatIDR(settings.minWithdrawal)} · Pendapatan order lunas otomatis bisa
            ditarik setelah {settings.holdDays} hari.
          </Text>

          <Text style={styles.section}>Rekening tujuan</Text>
          {accounts.length === 0 ? (
            <EmptyState
              icon="card-outline"
              message="Belum ada rekening"
              hint="Tambahkan rekening bank atau e-wallet untuk menerima pencairan."
              actionLabel="Tambah Rekening"
              onPressAction={() => router.push('/(mechanic)/payout-accounts')}
            />
          ) : (
            <View style={styles.accountList}>
              {accounts.map((account) => {
                const active = account.id === selectedAccountId;
                return (
                  <Pressable
                    key={account.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedAccountId(account.id)}
                    style={({ pressed }) => [
                      styles.accountCard,
                      active && styles.accountCardActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.accountIcon, active && styles.accountIconActive]}>
                      <Ionicons
                        name={account.type === 'ewallet' ? 'phone-portrait-outline' : 'business-outline'}
                        size={18}
                        color={active ? Brand.primary : Brand.textSecondary}
                      />
                    </View>
                    <View style={styles.accountCopy}>
                      <Text style={styles.accountTitle}>
                        {channelLabel(account.bank_code)}
                        {account.is_primary ? ' · Utama' : ''}
                      </Text>
                      <Text style={styles.accountSub}>
                        {maskAccountNumber(account.account_number)} · {account.account_holder_name}
                      </Text>
                    </View>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={19}
                      color={active ? Brand.primary : Brand.textMuted}
                    />
                  </Pressable>
                );
              })}
              <Button
                label="Kelola Rekening"
                icon="settings-outline"
                variant="secondary"
                onPress={() => router.push('/(mechanic)/payout-accounts')}
              />
            </View>
          )}

          {hasActive ? (
            <View style={styles.noticeCard}>
              <Ionicons name="time-outline" size={16} color={Brand.amber} />
              <Text style={styles.noticeText}>
                Masih ada pencairan yang diproses. Tunggu hingga selesai sebelum mengajukan lagi.
              </Text>
            </View>
          ) : null}

          <Button
            label="Ajukan Pencairan"
            icon="arrow-up-circle-outline"
            loading={submitting}
            disabled={!canSubmit}
            onPress={submit}
            style={styles.submit}
          />

          {withdrawals.length > 0 ? (
            <>
              <Text style={styles.section}>Riwayat pencairan</Text>
              <View style={styles.historyCard}>
                {withdrawals.map((item, index) => {
                  const meta = withdrawalStatusMeta(item.status);
                  return (
                    <View
                      key={item.id}
                      style={[styles.historyRow, index === 0 && styles.historyRowFirst]}
                    >
                      <View style={styles.historyCopy}>
                        <Text style={styles.historyAmount}>{formatIDR(item.amount)}</Text>
                        <Text style={styles.historyMeta}>
                          {item.account_snapshot?.bank_code
                            ? `${channelLabel(item.account_snapshot.bank_code)} · `
                            : ''}
                          {formatDateTime(item.created_at)}
                        </Text>
                        {item.failure_code ? (
                          <Text style={styles.historyFailure}>{item.failure_code}</Text>
                        ) : null}
                      </View>
                      <View style={[styles.statusChip, { backgroundColor: meta.background }]}>
                        <Text style={[styles.statusChipText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  balanceCard: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.lg,
    padding: Space.lg,
    ...CardShadow,
  },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  balanceValue: {
    color: Brand.white,
    fontSize: 28,
    fontWeight: '700',
    marginTop: Space.xs,
    letterSpacing: -0.5,
  },
  balanceMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: Space.md },
  metaPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaPillText: { color: Brand.white, fontSize: 10.5, fontWeight: '600' },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.xxl,
    marginBottom: Space.md,
  },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
  currency: { fontSize: 16, fontWeight: '700', color: Brand.textSecondary },
  amountInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 22,
    fontWeight: '700',
    color: Brand.text,
    paddingVertical: 0,
  },
  allButton: {
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 7,
  },
  allButtonText: { color: Brand.primary, fontSize: 12, fontWeight: '700' },
  validation: { color: Brand.red, fontSize: 11.5, marginTop: 6 },
  helper: { color: Brand.textMuted, fontSize: 11, marginTop: 8, lineHeight: 16 },
  accountList: { gap: Space.sm },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.md,
  },
  accountCardActive: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconActive: { backgroundColor: Brand.white },
  accountCopy: { flex: 1 },
  accountTitle: { fontSize: 13.5, fontWeight: '700', color: Brand.text },
  accountSub: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.lg,
  },
  noticeText: { flex: 1, fontSize: 11.5, color: Brand.amber, lineHeight: 16 },
  submit: { marginTop: Space.xxl },
  historyCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    paddingHorizontal: Space.lg,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.divider,
  },
  historyRowFirst: { borderTopWidth: 0 },
  historyCopy: { flex: 1 },
  historyAmount: { fontSize: 14, fontWeight: '700', color: Brand.text },
  historyMeta: { fontSize: 11, color: Brand.textSecondary, marginTop: 2 },
  historyFailure: { fontSize: 10.5, color: Brand.red, marginTop: 2 },
  statusChip: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  statusChipText: { fontSize: 10.5, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
