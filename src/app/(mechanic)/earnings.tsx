import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Money } from '@/components/ui/money';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SectionHeader } from '@/components/ui/section-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { channelLabel, withdrawalStatusMeta } from '@/features/finance/constants';
import {
  getWallet,
  listWithdrawals,
  type MechanicWallet,
  type Withdrawal,
} from '@/features/finance/service';
import {
  getEarningsSummary,
  type EarningsSummary,
} from '@/features/mechanic/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime, formatIDR } from '@/utils/format';

type Period = 'day' | 'week' | 'month';

const ZERO: EarningsSummary = {
  totalJobs: 0,
  gross: 0,
  fee: 0,
  net: 0,
  cashNet: 0,
};

const PERIODS: SegmentedOption<Period>[] = [
  { value: 'day', label: 'Hari ini' },
  { value: 'week', label: 'Minggu' },
  { value: 'month', label: 'Bulan' },
];

const PERIOD_LABEL: Record<Period, string> = {
  day: 'hari ini',
  week: 'minggu ini',
  month: 'bulan ini',
};

function startOf(period: Period): string {
  const d = new Date();
  if (period === 'day') d.setHours(0, 0, 0, 0);
  if (period === 'week') {
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
  }
  if (period === 'month') {
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
  }
  return d.toISOString();
}

export default function MechanicEarningsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [day, setDay] = useState<EarningsSummary>(ZERO);
  const [week, setWeek] = useState<EarningsSummary>(ZERO);
  const [month, setMonth] = useState<EarningsSummary>(ZERO);
  const [wallet, setWallet] = useState<MechanicWallet | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, w, m, saldo, history] = await Promise.all([
        getEarningsSummary(startOf('day')),
        getEarningsSummary(startOf('week')),
        getEarningsSummary(startOf('month')),
        getWallet(),
        listWithdrawals(10),
      ]);
      setDay(d);
      setWeek(w);
      setMonth(m);
      setWallet(saldo);
      setWithdrawals(history);
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

  const active = period === 'day' ? day : period === 'week' ? week : month;
  const available = wallet?.available_balance ?? 0;
  const commissionDebt = wallet?.commission_debt ?? 0;
  const netRatio = useMemo(
    () =>
      active.gross > 0
        ? Math.max(0, Math.min(1, active.net / active.gross))
        : 0,
    [active.gross, active.net],
  );
  const feeRatio = Math.max(0, 1 - netRatio);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Pendapatan"
        subtitle="Arus kas dan performa kerjamu"
      />
      {loading ? (
        <LoadingState message="Memuat pendapatan..." />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: theme.spacing.xxxl + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.actionPrimaryBg}
              colors={[theme.colors.actionPrimaryBg]}
            />
          }
        >
          {error ? (
            <ErrorState onRetry={() => void load()} />
          ) : (
            <>
              <Surface variant="elevated" padding="lg" style={styles.hero}>
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
                      Menunggu
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
                      Ditahan
                    </AppText>
                    <Money
                      value={wallet?.held_balance ?? 0}
                      size="sm"
                      color={theme.colors.textPrimary}
                    />
                  </View>
                  <View style={styles.heroMetaDivider} />
                  <View style={styles.heroMetaItem}>
                    <AppText variant="caption" tone="muted">
                      Total pendapatan
                    </AppText>
                    <Money
                      value={wallet?.total_earned ?? 0}
                      size="sm"
                      color={theme.colors.textPrimary}
                    />
                  </View>
                </View>

                <View style={styles.heroActions}>
                  <Button
                    label="Tarik saldo"
                    icon="arrow-up-outline"
                    variant="primary"
                    onPress={() => router.push('/(mechanic)/withdraw')}
                    style={styles.heroActionBtn}
                  />
                  <Button
                    label="Rekening"
                    icon="card-outline"
                    variant="secondary"
                    onPress={() => router.push('/(mechanic)/payout-accounts')}
                  />
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
                    {formatIDR(commissionDebt)}. Penarikan saldo dijeda sampai
                    tunggakan lunas otomatis dari pendapatan online.
                  </AppText>
                </Surface>
              ) : null}

              <SectionHeader eyebrow="PERFORMA" title="Rincian pendapatan" />
              <Segmented options={PERIODS} value={period} onChange={setPeriod} />

              <Surface variant="default" padding="lg" style={styles.panel}>
                <View style={styles.panelTop}>
                  <View style={styles.panelCopy}>
                    <AppText variant="caption" tone="secondary">
                      Bersih diterima {PERIOD_LABEL[period]}
                    </AppText>
                    <Money
                      value={active.net}
                      size="lg"
                      color={theme.colors.textPrimary}
                      style={styles.panelAmount}
                    />
                  </View>
                  <Surface variant="subtle" padding="sm" radius="md" style={styles.jobsPill}>
                    <AppText variant="title" tabular>
                      {active.totalJobs}
                    </AppText>
                    <AppText variant="overline" tone="muted">
                      job
                    </AppText>
                  </Surface>
                </View>

                <View style={styles.splitTrack}>
                  <View style={[styles.splitNet, { flex: netRatio }]} />
                  <View style={[styles.splitFee, { flex: feeRatio }]} />
                </View>

                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: theme.colors.statusSuccessFg },
                      ]}
                    />
                    <AppText variant="caption" tone="muted">
                      Bersih
                    </AppText>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: theme.colors.borderInput },
                      ]}
                    />
                    <AppText variant="caption" tone="muted">
                      Fee platform
                    </AppText>
                  </View>
                </View>

                <View style={styles.panelRows}>
                  <Row label="Pendapatan kotor" value={formatIDR(active.gross)} />
                  <Row label="Fee platform" value={`− ${formatIDR(active.fee)}`} />
                  {active.cashNet > 0 ? (
                    <Row label="Termasuk tunai" value={formatIDR(active.cashNet)} />
                  ) : null}
                </View>
              </Surface>

              {active.cashNet > 0 ? (
                <Surface variant="outlined" padding="md" style={styles.cashNote}>
                  <Ionicons
                    name="cash-outline"
                    size={18}
                    color={theme.colors.statusWarningFg}
                  />
                  <AppText variant="caption" tone="warning" style={styles.cashNoteText}>
                    {formatIDR(active.cashNet)} dari pendapatan {PERIOD_LABEL[period]}{' '}
                    diterima langsung secara tunai dan tidak masuk saldo dompet.
                  </AppText>
                </Surface>
              ) : null}

              {withdrawals.length > 0 ? (
                <>
                  <SectionHeader
                    eyebrow="PENCAIRAN"
                    title="Riwayat pencairan"
                    actionLabel="Tarik saldo"
                    onPressAction={() => router.push('/(mechanic)/withdraw')}
                  />
                  <Surface variant="default" padding="lg" style={styles.historyCard}>
                    {withdrawals.map((item, index) => {
                      const meta = withdrawalStatusMeta(item.status);
                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.historyRow,
                            index === 0 && styles.historyRowFirst,
                          ]}
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
                          </View>
                          <Badge size="sm" tone={meta.tone} label={meta.label} />
                        </View>
                      );
                    })}
                  </Surface>
                </>
              ) : null}

              <AppText variant="caption" tone="muted" style={styles.note}>
                Ringkasan pendapatan diperbarui otomatis setelah setiap pembayaran
                terverifikasi.
              </AppText>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="label" tabular>
        {value}
      </AppText>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    padding: theme.spacing.screenPadding,
  },
  hero: {
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
    gap: theme.spacing.sm,
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
  heroActions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  heroActionBtn: {
    flex: 1,
  },
  debtCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
    marginTop: theme.spacing.md,
  },
  debtCardText: {
    flex: 1,
  },
  panel: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  panelTop: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  panelCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  panelAmount: {
    marginTop: 2,
  },
  jobsPill: {
    minWidth: 56,
    alignItems: 'center' as const,
  },
  splitTrack: {
    flexDirection: 'row' as const,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden' as const,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  splitNet: {
    backgroundColor: theme.colors.statusSuccessFg,
  },
  splitFee: {
    backgroundColor: theme.colors.borderInput,
  },
  legend: {
    flexDirection: 'row' as const,
    gap: theme.spacing.lg,
  },
  legendItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  panelRows: {
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  cashNote: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
    marginTop: theme.spacing.md,
  },
  cashNoteText: {
    flex: 1,
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
  note: {
    marginTop: theme.spacing.lg,
  },
});
