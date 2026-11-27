import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import type { MechanicWallet } from '@/features/finance/types';
import { formatIDR } from '@/utils/format';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface BalanceCardProps {
  wallet: MechanicWallet | null;
  loading?: boolean;
  onPressWithdraw?: () => void;
  onPressAccounts?: () => void;
}

/** Kartu saldo montir: saldo bisa ditarik + pendapatan yang masih ditahan. */
export function BalanceCard({
  wallet,
  loading = false,
  onPressWithdraw,
  onPressAccounts,
}: BalanceCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const available = wallet?.available_balance ?? 0;
  const pending = wallet?.pending_balance ?? 0;
  const held = wallet?.held_balance ?? 0;
  const debt = wallet?.commission_debt ?? 0;

  return (
    <Surface variant="elevated" padding="lg" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <View style={styles.walletIcon}>
            <Ionicons
              name="wallet-outline"
              size={16}
              color={theme.colors.statusInfoFg}
            />
          </View>
          <AppText variant="label" tone="secondary">
            Saldo MontirGo Pay
          </AppText>
        </View>
        <Badge
          size="sm"
          dot={!loading}
          tone={loading ? 'neutral' : 'success'}
          label={loading ? 'Memuat' : 'Tersedia'}
        />
      </View>

      <Money
        value={available}
        size="hero"
        color={theme.colors.textPrimary}
        prefixColor={theme.colors.textSecondary}
        style={styles.amount}
      />

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <AppText variant="caption" tone="muted">
            Menunggu settlement
          </AppText>
          <Money value={pending} size="sm" color={theme.colors.textPrimary} />
        </View>
        <View style={styles.metaDivider} />
        <View style={styles.metaItem}>
          <AppText variant="caption" tone="muted">
            {held > 0 ? 'Sedang dicairkan' : 'Total pendapatan'}
          </AppText>
          <Money
            value={held > 0 ? held : (wallet?.total_earned ?? 0)}
            size="sm"
            color={theme.colors.textPrimary}
          />
        </View>
      </View>

      {debt > 0 ? (
        <View style={styles.debtBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={16}
            color={theme.colors.statusWarningFg}
          />
          <AppText
            variant="caption"
            style={[styles.debtText, { color: theme.colors.statusWarningFg }]}
          >
            Tunggakan komisi tunai {formatIDR(debt)}. Penarikan saldo dijeda sampai tunggakan lunas.
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Tarik saldo"
          icon="arrow-up-outline"
          variant="primary"
          disabled={!onPressWithdraw}
          onPress={onPressWithdraw}
          style={styles.primaryBtn}
        />
        <Button
          label="Rekening"
          icon="card-outline"
          variant="secondary"
          disabled={!onPressAccounts}
          onPress={onPressAccounts}
        />
      </View>
    </Surface>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    marginTop: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  labelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  walletIcon: {
    width: 30,
    height: 30,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  amount: {
    marginTop: theme.spacing.md,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  metaItem: {
    flex: 1,
    gap: 2,
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.borderSubtle,
  },
  debtBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
  },
  debtText: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  primaryBtn: {
    flex: 1,
  },
});
