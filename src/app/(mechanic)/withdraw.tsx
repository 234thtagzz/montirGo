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
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Money } from '@/components/ui/money';
import { SectionHeader } from '@/components/ui/section-header';
import { Ionicons } from '@/components/ui/icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state';
import {
  Brand,
  CardShadow,
  Radius,
  ScreenPadding,
  Space,
  Tabular,
  Type,
} from '@/constants/brand';
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

const QUICK_RATIOS = [0.25, 0.5, 0.75, 1];

export default function WithdrawScreen() {
  const router = useRouter();

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
    amount > 0 &&
    !validation &&
    Boolean(selectedAccount);

  const submit = async () => {
    if (!canSubmit || !selectedAccount) return;
    setSubmitting(true);
    try {
      await requestWithdrawal(amount, selectedAccount.id);
      setConfirmOpen(false);
      setSuccessAmount(amount);
      setAmountText('');
      await load();
    } catch (e) {
      Alert.alert(
        'Pencairan gagal',
        e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
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

  const accountName = selectedAccount ? channelLabel(selectedAccount.bank_code) : '—';

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
          {successAmount !== null ? (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={16} color={Brand.green} />
              </View>
              <View style={styles.successCopy}>
                <Text style={styles.successTitle}>Pencairan diajukan</Text>
                <Text style={styles.successText}>
                  {formatIDR(successAmount)} sedang diproses ke rekening tujuan.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tutup notifikasi"
                hitSlop={10}
                onPress={() => setSuccessAmount(null)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Ionicons name="close" size={18} color={Brand.textMuted} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroLabelRow}>
                <View style={styles.liveDot} />
                <Text style={styles.heroLabel}>Saldo bisa ditarik</Text>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="shield-checkmark" size={12} color={Brand.volt} />
                <Text style={styles.heroBadgeText}>Xendit</Text>
              </View>
            </View>
            <Money
              value={available}
              size="hero"
              color={Brand.white}
              prefixColor={Brand.inkMuted}
              style={styles.heroAmount}
            />
            <View style={styles.heroMeta}>
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaLabel}>Menunggu settlement</Text>
                <Money value={wallet?.pending_balance ?? 0} size="sm" color={Brand.inkText} />
              </View>
              <View style={styles.heroMetaDivider} />
              <View style={styles.heroMetaItem}>
                <Text style={styles.heroMetaLabel}>Sedang ditahan</Text>
                <Money value={wallet?.held_balance ?? 0} size="sm" color={Brand.inkText} />
              </View>
            </View>
          </View>

          <SectionHeader eyebrow="NOMINAL" title="Mau tarik berapa?" />
          <View style={styles.amountCard}>
            <Text style={styles.currency}>Rp</Text>
            <TextInput
              value={amountText ? amount.toLocaleString('id-ID') : ''}
              onChangeText={(text) => {
                setAmountText(text.replace(/[^0-9]/g, ''));
                setSuccessAmount(null);
              }}
              placeholder="0"
              placeholderTextColor={Brand.textMuted}
              keyboardType="number-pad"
              selectionColor={Brand.primary}
              accessibilityLabel="Nominal pencairan"
              style={[styles.amountInput, Tabular]}
            />
          </View>

          {quickAmounts.length > 0 ? (
            <View style={styles.quickRow}>
              {quickAmounts.map((item) => {
                const active = amount === item.value;
                return (
                  <Pressable
                    key={item.ratio}
                    accessibilityRole="button"
                    accessibilityLabel={`Isi ${item.label} dari saldo`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setAmountText(String(item.value));
                      setSuccessAmount(null);
                    }}
                    style={({ pressed }) => [
                      styles.quickChip,
                      active && styles.quickChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.quickText, active && styles.quickTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {validation ? (
            <View style={styles.validationRow}>
              <Ionicons name="alert-circle" size={14} color={Brand.red} />
              <Text style={styles.validation}>{validation}</Text>
            </View>
          ) : (
            <Text style={styles.helper}>
              Minimal {formatIDR(settings.minWithdrawal)} · Dana order lunas dapat ditarik
              setelah {settings.holdDays} hari.
            </Text>
          )}

          <SectionHeader
            eyebrow="TUJUAN"
            title="Rekening penerima"
            actionLabel={accounts.length > 0 ? 'Kelola' : undefined}
            onPressAction={
              accounts.length > 0
                ? () => router.push('/(mechanic)/payout-accounts')
                : undefined
            }
          />

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
                    accessibilityLabel={`${channelLabel(account.bank_code)} ${maskAccountNumber(
                      account.account_number,
                    )}`}
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
                        name={
                          account.type === 'ewallet'
                            ? 'phone-portrait-outline'
                            : 'business-outline'
                        }
                        size={18}
                        color={active ? Brand.primary : Brand.textSecondary}
                      />
                    </View>
                    <View style={styles.accountCopy}>
                      <View style={styles.accountTitleRow}>
                        <Text style={styles.accountTitle}>{channelLabel(account.bank_code)}</Text>
                        {account.is_primary ? (
                          <View style={styles.primaryChip}>
                            <Text style={styles.primaryChipText}>Utama</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.accountSub}>
                        {maskAccountNumber(account.account_number)} ·{' '}
                        {account.account_holder_name}
                      </Text>
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={active ? Brand.primary : Brand.border}
                    />
                  </Pressable>
                );
              })}
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

          {amount > 0 && selectedAccount ? (
            <View style={styles.summary}>
              <Text style={styles.summaryEyebrow}>RINGKASAN</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Nominal</Text>
                <Money value={amount} size="sm" color={Brand.text} />
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tujuan</Text>
                <Text style={styles.summaryValue}>
                  {accountName} · {maskAccountNumber(selectedAccount.account_number)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Metode</Text>
                <Text style={styles.summaryValue}>Xendit payout</Text>
              </View>
              <Text style={styles.summaryNote}>
                Saldo langsung ditahan sampai pencairan selesai. Bila gagal, saldo dikembalikan
                otomatis.
              </Text>
            </View>
          ) : null}

          <Button
            label={hasActive ? 'Pencairan sedang diproses' : 'Ajukan Pencairan'}
            icon="arrow-up-circle-outline"
            variant="ink"
            loading={submitting}
            disabled={!canSubmit}
            onPress={() => setConfirmOpen(true)}
            style={styles.submit}
          />

          {withdrawals.length > 0 ? (
            <>
              <SectionHeader eyebrow="RIWAYAT" title="Pencairan terakhir" />
              <View style={styles.historyCard}>
                {withdrawals.map((item, index) => {
                  const meta = withdrawalStatusMeta(item.status);
                  return (
                    <View
                      key={item.id}
                      style={[styles.historyRow, index === 0 && styles.historyRowFirst]}
                    >
                      <View style={styles.historyIcon}>
                        <Ionicons
                          name="arrow-up-outline"
                          size={15}
                          color={Brand.textSecondary}
                        />
                      </View>
                      <View style={styles.historyCopy}>
                        <Money value={item.amount} size="sm" color={Brand.text} />
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

      <ConfirmSheet
        visible={confirmOpen}
        title="Konfirmasi pencairan"
        message="Dana akan ditahan dari saldo sampai pencairan selesai diproses."
        confirmLabel="Tarik sekarang"
        loading={submitting}
        icon="arrow-up-circle-outline"
        onConfirm={submit}
        onCancel={() => setConfirmOpen(false)}
      >
        <View style={styles.sheetSummary}>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Nominal</Text>
            <Money value={amount} size="md" color={Brand.text} />
          </View>
          <View style={styles.sheetDivider} />
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Ke rekening</Text>
            <Text style={styles.sheetValue}>
              {accountName}
              {selectedAccount ? ` · ${maskAccountNumber(selectedAccount.account_number)}` : ''}
            </Text>
          </View>
          <View style={styles.sheetRow}>
            <Text style={styles.sheetLabel}>Atas nama</Text>
            <Text style={styles.sheetValue}>{selectedAccount?.account_holder_name ?? '—'}</Text>
          </View>
        </View>
      </ConfirmSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  hero: {
    backgroundColor: Brand.ink,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Brand.inkBorder,
    padding: Space.xl,
    ...CardShadow,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.volt },
  heroLabel: { ...Type.label, color: Brand.inkText },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201,241,88,0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroBadgeText: { ...Type.micro, color: Brand.volt, fontSize: 9, letterSpacing: 0.4 },
  heroAmount: { marginTop: Space.md },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.lg,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: Brand.inkBorder,
  },
  heroMetaItem: { flex: 1 },
  heroMetaDivider: { width: 1, height: 26, backgroundColor: Brand.inkBorder },
  heroMetaLabel: { ...Type.meta, color: Brand.inkMuted, marginBottom: 3, fontSize: 10 },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(14,159,110,0.2)',
    padding: Space.md,
    marginBottom: Space.md,
  },
  successIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCopy: { flex: 1 },
  successTitle: { ...Type.label, color: Brand.green, fontWeight: '700' },
  successText: { ...Type.meta, color: Brand.textSecondary, marginTop: 1 },
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
  currency: { ...Type.title, color: Brand.textSecondary },
  amountInput: {
    flex: 1,
    minHeight: 52,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: Brand.text,
    paddingVertical: 0,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: Space.md },
  quickChip: {
    minHeight: 38,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.pill,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipActive: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryBorder },
  quickText: { ...Type.label, color: Brand.textSecondary },
  quickTextActive: { color: Brand.primaryDark, fontWeight: '800' },
  helper: { ...Type.meta, color: Brand.textMuted, marginTop: Space.sm, lineHeight: 17 },
  validationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Space.sm },
  validation: { ...Type.meta, color: Brand.red, fontWeight: '600' },
  accountList: { gap: Space.sm },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.md,
  },
  accountCardActive: { borderColor: Brand.primary, backgroundColor: Brand.primarySoft },
  accountIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconActive: { backgroundColor: Brand.surface },
  accountCopy: { flex: 1 },
  accountTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accountTitle: { ...Type.bodyStrong, color: Brand.text },
  primaryChip: {
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  primaryChipText: { ...Type.micro, color: Brand.primaryDark, fontSize: 8.5 },
  accountSub: { ...Type.meta, color: Brand.textSecondary, marginTop: 2 },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.lg,
  },
  noticeText: { flex: 1, ...Type.meta, color: Brand.amber, lineHeight: 17 },
  summary: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.lg,
    marginTop: Space.xl,
  },
  summaryEyebrow: { ...Type.micro, color: Brand.textMuted, marginBottom: Space.sm },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
    paddingVertical: 6,
  },
  summaryLabel: { ...Type.meta, color: Brand.textSecondary },
  summaryValue: { ...Type.meta, color: Brand.text, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  summaryNote: {
    ...Type.meta,
    color: Brand.textMuted,
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
    lineHeight: 17,
  },
  submit: { marginTop: Space.xl },
  historyCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
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
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCopy: { flex: 1 },
  historyMeta: { ...Type.meta, color: Brand.textSecondary, marginTop: 2, fontSize: 10.5 },
  historyFailure: { ...Type.meta, color: Brand.red, marginTop: 2, fontSize: 10 },
  statusChip: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  statusChipText: { ...Type.micro, fontSize: 9.5, letterSpacing: 0.2 },
  sheetSummary: {
    backgroundColor: Brand.background,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
    paddingVertical: 5,
  },
  sheetLabel: { ...Type.meta, color: Brand.textSecondary },
  sheetValue: {
    ...Type.meta,
    color: Brand.text,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Brand.border,
    marginVertical: Space.xs,
  },
  pressed: { opacity: 0.75 },
});
