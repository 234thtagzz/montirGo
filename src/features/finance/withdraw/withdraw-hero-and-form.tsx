import { Pressable, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { channelLabel, maskAccountNumber } from '@/features/finance/constants';
import type {
  FinanceSettings,
  MechanicWallet,
  PayoutAccount,
} from '@/features/finance/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

interface WithdrawHeroAndFormProps {
  wallet: MechanicWallet | null;
  available: number;
  commissionDebt: number;
  settings: FinanceSettings;
  amountText: string;
  amount: number;
  onChangeAmountText: (value: string) => void;
  quickAmounts: { ratio: number; label: string; value: number }[];
  validation: string | null;
  accounts: PayoutAccount[];
  selectedAccountId: string | null;
  selectedAccount: PayoutAccount | null;
  onSelectAccount: (id: string) => void;
  hasActive: boolean;
  canSubmit: boolean;
  submitting: boolean;
  successAmount: number | null;
  onDismissSuccess: () => void;
  onManageAccounts: () => void;
  onOpenConfirm: () => void;
}

export function WithdrawHeroAndForm({
  wallet,
  available,
  commissionDebt,
  settings,
  amountText,
  amount,
  onChangeAmountText,
  quickAmounts,
  validation,
  accounts,
  selectedAccountId,
  selectedAccount,
  onSelectAccount,
  hasActive,
  canSubmit,
  submitting,
  successAmount,
  onDismissSuccess,
  onManageAccounts,
  onOpenConfirm,
}: WithdrawHeroAndFormProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const accountName = selectedAccount
    ? channelLabel(selectedAccount.bank_code)
    : '—';

  return (
    <View style={styles.wrap}>
      {successAmount !== null ? (
        <Surface variant="outlined" padding="md" style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons
              name="checkmark"
              size={16}
              color={theme.colors.statusSuccessFg}
            />
          </View>
          <View style={styles.successCopy}>
            <AppText variant="label" tone="success">
              Pencairan diajukan
            </AppText>
            <AppText variant="caption" tone="secondary">
              {formatIDR(successAmount)} sedang diproses ke rekening tujuan.
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup notifikasi"
            hitSlop={10}
            onPress={onDismissSuccess}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </Surface>
      ) : null}

      <Surface variant="elevated" padding="lg" style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroLabelRow}>
            <View style={styles.liveDot} />
            <AppText variant="label" tone="secondary">
              Saldo bisa ditarik
            </AppText>
          </View>
          <Badge
            size="sm"
            tone="info"
            icon="shield-checkmark-outline"
            label="Xendit"
          />
        </View>

        <Money
          value={available}
          size="hero"
          color={theme.colors.textPrimary}
          prefixColor={theme.colors.textSecondary}
          style={styles.heroAmount}
        />

        <View style={styles.heroMeta}>
          <View style={styles.heroMetaItem}>
            <AppText variant="caption" tone="muted">
              Menunggu settlement
            </AppText>
            <Money
              value={wallet?.pending_balance ?? 0}
              size="sm"
              color={theme.colors.textPrimary}
            />
          </View>
          <View style={styles.heroMetaDivider} />
          <View style={styles.heroMetaItem}>
            <AppText variant="caption" tone="muted">
              Sedang ditahan
            </AppText>
            <Money
              value={wallet?.held_balance ?? 0}
              size="sm"
              color={theme.colors.textPrimary}
            />
          </View>
        </View>
      </Surface>

      {commissionDebt > 0 ? (
        <Surface variant="outlined" padding="md" style={styles.debtCard}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={theme.colors.statusWarningFg}
          />
          <AppText variant="caption" tone="warning" style={styles.debtCardText}>
            Kamu memiliki tunggakan komisi order tunai sebesar{' '}
            {formatIDR(commissionDebt)}. Penarikan saldo dijeda sampai tunggakan lunas
            otomatis dari pendapatan online.
          </AppText>
        </Surface>
      ) : null}

      <SectionHeader eyebrow="NOMINAL" title="Mau tarik berapa?" />
      <TextField
        label="Nominal pencairan (Rp)"
        value={amountText ? amount.toLocaleString('id-ID') : ''}
        onChangeText={(text) => {
          onChangeAmountText(text.replace(/[^0-9]/g, ''));
          onDismissSuccess();
        }}
        placeholder="0"
        keyboardType="number-pad"
        error={validation}
        showError={Boolean(validation)}
        hint={
          validation
            ? undefined
            : `Minimal ${formatIDR(settings.minWithdrawal)} · Dana order lunas dapat ditarik setelah ${settings.holdDays} hari.`
        }
      />

      {quickAmounts.length > 0 ? (
        <View style={styles.quickRow}>
          {quickAmounts.map((item) => (
            <Chip
              key={item.ratio}
              label={item.label}
              selected={amount === item.value}
              tone="info"
              onPress={() => {
                onChangeAmountText(String(item.value));
                onDismissSuccess();
              }}
            />
          ))}
        </View>
      ) : null}

      <SectionHeader
        eyebrow="TUJUAN"
        title="Rekening penerima"
        actionLabel={accounts.length > 0 ? 'Kelola' : undefined}
        onPressAction={accounts.length > 0 ? onManageAccounts : undefined}
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon="card-outline"
          message="Belum ada rekening"
          hint="Tambahkan rekening bank atau e-wallet untuk menerima pencairan."
          actionLabel="Tambah Rekening"
          onPressAction={onManageAccounts}
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
                onPress={() => onSelectAccount(account.id)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Surface
                  variant="default"
                  padding="md"
                  style={[styles.accountCard, active && styles.accountCardActive]}
                >
                  <View
                    style={[
                      styles.accountIcon,
                      active && styles.accountIconActive,
                    ]}
                  >
                    <Ionicons
                      name={
                        account.type === 'ewallet'
                          ? 'phone-portrait-outline'
                          : 'business-outline'
                      }
                      size={18}
                      color={
                        active
                          ? theme.colors.statusInfoFg
                          : theme.colors.textSecondary
                      }
                    />
                  </View>
                  <View style={styles.accountCopy}>
                    <View style={styles.accountTitleRow}>
                      <AppText variant="bodyStrong">
                        {channelLabel(account.bank_code)}
                      </AppText>
                      {account.is_primary ? (
                        <Badge size="sm" tone="info" label="Utama" />
                      ) : null}
                    </View>
                    <AppText variant="caption" tone="secondary">
                      {maskAccountNumber(account.account_number)} ·{' '}
                      {account.account_holder_name}
                    </AppText>
                  </View>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={
                      active
                        ? theme.colors.actionPrimaryBg
                        : theme.colors.borderInput
                    }
                  />
                </Surface>
              </Pressable>
            );
          })}
        </View>
      )}

      {hasActive ? (
        <Surface variant="outlined" padding="md" style={styles.noticeCard}>
          <Ionicons
            name="time-outline"
            size={18}
            color={theme.colors.statusWarningFg}
          />
          <AppText variant="caption" tone="warning" style={styles.noticeText}>
            Masih ada pencairan yang diproses. Tunggu hingga selesai sebelum mengajukan
            lagi.
          </AppText>
        </Surface>
      ) : null}

      {amount > 0 && selectedAccount ? (
        <Surface variant="default" padding="lg" style={styles.summary}>
          <AppText variant="overline" tone="muted">
            RINGKASAN
          </AppText>
          <View style={styles.summaryRow}>
            <AppText variant="caption" tone="secondary">
              Nominal
            </AppText>
            <Money value={amount} size="sm" color={theme.colors.textPrimary} />
          </View>
          <View style={styles.summaryRow}>
            <AppText variant="caption" tone="secondary">
              Tujuan
            </AppText>
            <AppText variant="label">
              {accountName} · {maskAccountNumber(selectedAccount.account_number)}
            </AppText>
          </View>
          <View style={styles.summaryRow}>
            <AppText variant="caption" tone="secondary">
              Metode
            </AppText>
            <AppText variant="label">Xendit payout</AppText>
          </View>
          <AppText variant="caption" tone="muted" style={styles.summaryNote}>
            Saldo langsung ditahan sampai pencairan selesai. Bila gagal, saldo
            dikembalikan otomatis.
          </AppText>
        </Surface>
      ) : null}

      <Button
        label={hasActive ? 'Pencairan sedang diproses' : 'Ajukan Pencairan'}
        icon="arrow-up-circle-outline"
        variant="primary"
        size="cta"
        loading={submitting}
        disabled={!canSubmit}
        onPress={onOpenConfirm}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    gap: theme.spacing.md,
  },
  successCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.statusSuccessBg,
    borderColor: theme.colors.statusSuccessBorder,
  },
  successIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  successCopy: {
    flex: 1,
    gap: 2,
  },
  heroCard: {
    gap: theme.spacing.sm,
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  heroLabelRow: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.statusSuccessFg,
  },
  heroAmount: {
    marginTop: theme.spacing.xs,
  },
  heroMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  heroMetaItem: {
    flex: 1,
    gap: 2,
  },
  heroMetaDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.borderSubtle,
  },
  debtCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
  },
  debtCardText: {
    flex: 1,
  },
  quickRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
  },
  accountList: {
    gap: theme.spacing.sm,
  },
  accountCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  accountCardActive: {
    borderColor: theme.colors.statusInfoBorder,
    backgroundColor: theme.colors.statusInfoBg,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  accountIconActive: {
    backgroundColor: theme.colors.bgSurface,
  },
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  noticeCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
  },
  noticeText: {
    flex: 1,
  },
  summary: {
    gap: theme.spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
    paddingVertical: 4,
  },
  summaryNote: {
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  pressed: {
    opacity: 0.78,
  },
});
