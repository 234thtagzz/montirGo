import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { SectionHeader } from '@/components/ui/section-header';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { channelLabel, withdrawalStatusMeta } from '@/features/finance/constants';
import type { Withdrawal } from '@/features/finance/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface WithdrawHistorySectionProps {
  withdrawals: Withdrawal[];
  syncingWithdrawalId: string | null;
  onSyncWithdrawal: (id: string) => void;
}

export function WithdrawHistorySection({
  withdrawals,
  syncingWithdrawalId,
  onSyncWithdrawal,
}: WithdrawHistorySectionProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  if (withdrawals.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <SectionHeader eyebrow="RIWAYAT" title="Pencairan terakhir" />
      <Surface variant="default" padding="lg" style={styles.historyCard}>
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
                  size={16}
                  color={theme.colors.textSecondary}
                />
              </View>
              <View style={styles.historyCopy}>
                <Money
                  value={item.amount}
                  size="sm"
                  color={theme.colors.textPrimary}
                />
                <AppText variant="caption" tone="secondary">
                  {item.account_snapshot?.bank_code
                    ? `${channelLabel(item.account_snapshot.bank_code)} · `
                    : ''}
                  {formatDateTime(item.created_at)}
                </AppText>
                {item.failure_code ? (
                  <AppText variant="caption" tone="danger">
                    {item.failure_code}
                  </AppText>
                ) : null}
                {item.status === 'requested' || item.status === 'processing' ? (
                  <Button
                    label="Cek Status Pencairan"
                    variant="secondary"
                    size="compact"
                    loading={syncingWithdrawalId === item.id}
                    onPress={() => onSyncWithdrawal(item.id)}
                    style={styles.syncBtn}
                  />
                ) : null}
              </View>
              <Badge size="sm" tone={meta.tone} label={meta.label} />
            </View>
          );
        })}
      </Surface>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    marginTop: theme.spacing.md,
  },
  historyCard: {
    paddingVertical: theme.spacing.xs,
  },
  historyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  historyRowFirst: {
    borderTopWidth: 0,
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  syncBtn: {
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-start' as const,
  },
});
