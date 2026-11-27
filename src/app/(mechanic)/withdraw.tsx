import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Money } from '@/components/ui/money';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { AppText } from '@/components/ui/text';
import { channelLabel, maskAccountNumber } from '@/features/finance/constants';
import { useWithdraw } from '@/features/finance/withdraw/use-withdraw';
import { WithdrawHeroAndForm } from '@/features/finance/withdraw/withdraw-hero-and-form';
import { WithdrawHistorySection } from '@/features/finance/withdraw/withdraw-history-section';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export default function WithdrawScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const state = useWithdraw();

  if (state.loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Tarik Saldo" />
        <LoadingState message="Memuat saldo..." />
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Tarik Saldo" />
        <ErrorState onRetry={() => void state.load()} />
      </View>
    );
  }

  const accountName = state.selectedAccount
    ? channelLabel(state.selectedAccount.bank_code)
    : '—';

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Tarik Saldo" subtitle="Pencairan via Xendit" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: theme.spacing.xxxl + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={state.refreshing}
              onRefresh={() => {
                state.setRefreshing(true);
                void state.load();
              }}
              tintColor={theme.colors.actionPrimaryBg}
              colors={[theme.colors.actionPrimaryBg]}
            />
          }
        >
          <WithdrawHeroAndForm
            wallet={state.wallet}
            available={state.available}
            commissionDebt={state.commissionDebt}
            settings={state.settings}
            amountText={state.amountText}
            amount={state.amount}
            onChangeAmountText={state.setAmountText}
            quickAmounts={state.quickAmounts}
            validation={state.validation}
            accounts={state.accounts}
            selectedAccountId={state.selectedAccountId}
            selectedAccount={state.selectedAccount}
            onSelectAccount={state.setSelectedAccountId}
            hasActive={state.hasActive}
            canSubmit={state.canSubmit}
            submitting={state.submitting}
            successAmount={state.successAmount}
            onDismissSuccess={() => state.setSuccessAmount(null)}
            onManageAccounts={() => router.push('/(mechanic)/payout-accounts')}
            onOpenConfirm={() => state.setConfirmOpen(true)}
          />

          <WithdrawHistorySection
            withdrawals={state.withdrawals}
            syncingWithdrawalId={state.syncingWithdrawalId}
            onSyncWithdrawal={(id) => void state.handleSyncWithdrawal(id)}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={state.confirmOpen}
        title="Konfirmasi pencairan"
        message="Dana akan ditahan dari saldo sampai pencairan selesai diproses."
        confirmLabel="Tarik sekarang"
        loading={state.submitting}
        icon="arrow-up-circle-outline"
        onConfirm={() => void state.submit()}
        onCancel={() => state.setConfirmOpen(false)}
      >
        <View style={styles.sheetSummary}>
          <View style={styles.sheetRow}>
            <AppText variant="caption" tone="secondary">
              Nominal
            </AppText>
            <Money value={state.amount} size="md" color={theme.colors.textPrimary} />
          </View>
          <View style={styles.sheetDivider} />
          <View style={styles.sheetRow}>
            <AppText variant="caption" tone="secondary">
              Ke rekening
            </AppText>
            <AppText variant="label">
              {accountName}
              {state.selectedAccount
                ? ` · ${maskAccountNumber(state.selectedAccount.account_number)}`
                : ''}
            </AppText>
          </View>
          <View style={styles.sheetRow}>
            <AppText variant="caption" tone="secondary">
              Atas nama
            </AppText>
            <AppText variant="label">
              {state.selectedAccount?.account_holder_name ?? '—'}
            </AppText>
          </View>
        </View>
      </ConfirmSheet>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.screenPadding,
  },
  sheetSummary: {
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  sheetRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: theme.colors.borderSubtle,
    marginVertical: theme.spacing.xxs,
  },
});
