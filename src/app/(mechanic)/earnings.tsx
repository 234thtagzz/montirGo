import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Money } from '@/components/ui/money';
import { SectionHeader } from '@/components/ui/section-header';
import { Ionicons } from '@/components/ui/icon';
import { ErrorState, LoadingState } from '@/components/ui/state';
import {
  Brand,
  CardShadow,
  Radius,
  ScreenPadding,
  Space,
  Tabular,
  Type,
} from '@/constants/brand';
import { getEarningsSummary, type EarningsSummary } from '@/features/mechanic/service';
import {
  getWallet,
  listWithdrawals,
  type MechanicWallet,
  type Withdrawal,
} from '@/features/finance/service';
import { channelLabel, withdrawalStatusMeta } from '@/features/finance/constants';
import { formatDateTime, formatIDR } from '@/utils/format';

type Period = 'day' | 'week' | 'month';

const ZERO: EarningsSummary = { totalJobs: 0, gross: 0, fee: 0, net: 0, cashNet: 0 };

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
      load();
    }, [load]),
  );

  const active = period === 'day' ? day : period === 'week' ? week : month;
  const available = wallet?.available_balance ?? 0;
  const netRatio = useMemo(
    () => (active.gross > 0 ? Math.max(0, Math.min(1, active.net / active.gross)) : 0),
    [active.gross, active.net],
  );
  const feeRatio = Math.max(0, 1 - netRatio);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Pendapatan" subtitle="Arus kas dan performa kerjamu" />
      {loading ? (
        <LoadingState message="Memuat pendapatan..." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
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
          {error ? (
            <ErrorState onRetry={load} />
          ) : (
            <>
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
                    <Text style={styles.heroMetaLabel}>Menunggu</Text>
                    <Money
                      value={wallet?.pending_balance ?? 0}
                      size="sm"
                      color={Brand.inkText}
                    />
                  </View>
                  <View style={styles.heroMetaDivider} />
                  <View style={styles.heroMetaItem}>
                    <Text style={styles.heroMetaLabel}>Ditahan</Text>
                    <Money value={wallet?.held_balance ?? 0} size="sm" color={Brand.inkText} />
                  </View>
                  <View style={styles.heroMetaDivider} />
                  <View style={styles.heroMetaItem}>
                    <Text style={styles.heroMetaLabel}>Total pendapatan</Text>
                    <Money
                      value={wallet?.total_earned ?? 0}
                      size="sm"
                      color={Brand.inkText}
                    />
                  </View>
                </View>

                <View style={styles.heroActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tarik saldo"
                    onPress={() => router.push('/(mechanic)/withdraw')}
                    style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}
                  >
                    <Text style={styles.heroActionText}>Tarik saldo</Text>
                    <Ionicons name="arrow-up" size={16} color={Brand.ink} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Kelola rekening pencairan"
                    onPress={() => router.push('/(mechanic)/payout-accounts')}
                    style={({ pressed }) => [
                      styles.heroSecondary,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="card-outline" size={16} color={Brand.inkText} />
                    <Text style={styles.heroSecondaryText}>Rekening</Text>
                  </Pressable>
                </View>
              </View>

              <SectionHeader eyebrow="PERFORMA" title="Rincian pendapatan" />
              <Segmented options={PERIODS} value={period} onChange={setPeriod} />

              <View style={styles.panel}>
                <View style={styles.panelTop}>
                  <View style={styles.panelCopy}>
                    <Text style={styles.panelLabel}>Bersih diterima {PERIOD_LABEL[period]}</Text>
                    <Money
                      value={active.net}
                      size="lg"
                      color={Brand.text}
                      style={styles.panelAmount}
                    />
                  </View>
                  <View style={styles.jobsPill}>
                    <Text style={styles.jobsValue}>{active.totalJobs}</Text>
                    <Text style={styles.jobsLabel}>job</Text>
                  </View>
                </View>

                <View style={styles.splitTrack}>
                  <View style={[styles.splitNet, { flex: netRatio }]} />
                  <View style={[styles.splitFee, { flex: feeRatio }]} />
                </View>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Brand.green }]} />
                    <Text style={styles.legendText}>Bersih</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#CFD8E6' }]} />
                    <Text style={styles.legendText}>Fee platform</Text>
                  </View>
                </View>

                <View style={styles.panelRows}>
                  <Row label="Pendapatan kotor" value={formatIDR(active.gross)} />
                  <Row label="Fee platform" value={`− ${formatIDR(active.fee)}`} />
                  {active.cashNet > 0 ? (
                    <Row label="Termasuk tunai" value={formatIDR(active.cashNet)} />
                  ) : null}
                </View>
              </View>

              {active.cashNet > 0 ? (
                <View style={styles.cashNote}>
                  <Ionicons name="cash-outline" size={16} color={Brand.amber} />
                  <Text style={styles.cashNoteText}>
                    {formatIDR(active.cashNet)} dari pendapatan {PERIOD_LABEL[period]} diterima
                    langsung secara tunai dan tidak masuk saldo dompet.
                  </Text>
                </View>
              ) : null}

              {withdrawals.length > 0 ? (
                <>
                  <SectionHeader
                    eyebrow="PENCAIRAN"
                    title="Riwayat pencairan"
                    actionLabel="Tarik saldo"
                    onPressAction={() => router.push('/(mechanic)/withdraw')}
                  />
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

              <Text style={styles.note}>
                Dihitung dari tabel earnings, diisi otomatis saat pembayaran terverifikasi (PRD
                §18).
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, Tabular]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
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
  heroActions: { flexDirection: 'row', gap: Space.sm, marginTop: Space.lg },
  heroAction: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Brand.volt,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
  },
  heroActionText: { ...Type.label, color: Brand.ink, fontWeight: '800' },
  heroSecondary: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.inkBorder,
    paddingHorizontal: Space.lg,
  },
  heroSecondaryText: { ...Type.label, color: Brand.inkText, fontWeight: '700' },
  panel: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: Space.lg,
    marginTop: Space.md,
  },
  panelTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  panelCopy: { flex: 1 },
  panelLabel: { ...Type.meta, color: Brand.textSecondary, fontWeight: '600' },
  panelAmount: { marginTop: Space.xs },
  jobsPill: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
  },
  jobsValue: { ...Type.title, color: Brand.text, ...Tabular },
  jobsLabel: { ...Type.micro, color: Brand.textMuted, fontSize: 9 },
  splitTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: Brand.divider,
    marginTop: Space.lg,
  },
  splitNet: { backgroundColor: Brand.green },
  splitFee: { backgroundColor: '#CFD8E6' },
  legend: { flexDirection: 'row', gap: Space.lg, marginTop: Space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { ...Type.meta, color: Brand.textMuted, fontSize: 10 },
  panelRows: {
    marginTop: Space.md,
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: Brand.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    gap: Space.md,
  },
  rowLabel: { ...Type.meta, color: Brand.textSecondary },
  rowValue: { ...Type.meta, color: Brand.text, fontWeight: '700', fontSize: 12 },
  cashNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.md,
  },
  cashNoteText: { flex: 1, ...Type.meta, color: Brand.amber, lineHeight: 17 },
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
  statusChip: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  statusChipText: { ...Type.micro, fontSize: 9.5, letterSpacing: 0.2 },
  note: { ...Type.meta, color: Brand.textMuted, marginTop: Space.lg, lineHeight: 16 },
  pressed: { opacity: 0.78 },
});
