import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, CardShadow, Gradient, Radius, ScreenPadding, Space } from '@/constants/brand';
import { getEarningsSummary, type EarningsSummary } from '@/features/mechanic/service';
import {
  getWallet,
  listWithdrawals,
  type MechanicWallet,
  type Withdrawal,
} from '@/features/finance/service';
import { channelLabel, withdrawalStatusMeta } from '@/features/finance/constants';
import { formatDateTime, formatIDR } from '@/utils/format';

const ZERO: EarningsSummary = { totalJobs: 0, gross: 0, fee: 0, net: 0 };

function startOf(period: 'day' | 'week' | 'month'): string {
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

  const sections: { label: string; s: EarningsSummary }[] = [
    { label: 'Hari ini', s: day },
    { label: 'Minggu ini', s: week },
    { label: 'Bulan ini', s: month },
  ];

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Pendapatan" subtitle="Ringkasan penghasilanmu" />
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
              <View style={styles.walletCard}>
                <View style={styles.walletRow}>
                  <View style={styles.walletCopy}>
                    <Text style={styles.walletLabel}>Saldo bisa ditarik</Text>
                    <Text style={styles.walletValue}>
                      {formatIDR(wallet?.available_balance ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.walletBadge}>
                    <Text style={styles.walletBadgeText}>
                      + {formatIDR(wallet?.pending_balance ?? 0)} pending
                    </Text>
                  </View>
                </View>
                <View style={styles.walletDivider} />
                <View style={styles.walletMetaRow}>
                  <View style={styles.walletMetaItem}>
                    <Text style={styles.walletMetaLabel}>Total pendapatan</Text>
                    <Text style={styles.walletMetaValue}>
                      {formatIDR(wallet?.total_earned ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.walletMetaItem}>
                    <Text style={styles.walletMetaLabel}>Sudah dicairkan</Text>
                    <Text style={styles.walletMetaValue}>
                      {formatIDR(wallet?.total_withdrawn ?? 0)}
                    </Text>
                  </View>
                </View>
                <View style={styles.walletActions}>
                  <Button
                    label="Tarik Saldo"
                    icon="arrow-up-circle-outline"
                    onPress={() => router.push('/(mechanic)/withdraw')}
                    style={styles.walletAction}
                  />
                  <Button
                    label="Rekening"
                    icon="card-outline"
                    variant="secondary"
                    onPress={() => router.push('/(mechanic)/payout-accounts')}
                    style={styles.walletAction}
                  />
                </View>
              </View>

              <LinearGradient
                colors={Gradient.promoGreen}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <Text style={styles.heroLabel}>Pendapatan bersih bulan ini</Text>
                <Text style={styles.heroValue} numberOfLines={1}>
                  {formatIDR(month.net)}
                </Text>
                <View style={styles.heroRow}>
                  <View style={styles.heroPill}>
                    <Text style={styles.heroPillText}>{month.totalJobs} job selesai</Text>
                  </View>
                  <View style={styles.heroPill}>
                    <Text style={styles.heroPillText}>Fee {formatIDR(month.fee)}</Text>
                  </View>
                </View>
              </LinearGradient>

              {sections.map(({ label, s }) => (
                <View key={label} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle}>{label}</Text>
                    <Text style={styles.cardJobs}>{s.totalJobs} job</Text>
                  </View>
                  <Row label="Pendapatan kotor" value={formatIDR(s.gross)} />
                  <Row label="Fee platform" value={`- ${formatIDR(s.fee)}`} />
                  <View style={styles.divider} />
                  <Row label="Bersih" value={formatIDR(s.net)} strong />
                </View>
              ))}

              {withdrawals.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Riwayat pencairan</Text>
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
                Dihitung dari tabel earnings, diisi otomatis saat pembayaran terverifikasi (PRD §18).
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.strongValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  hero: {
    borderRadius: Radius.lg,
    padding: Space.xl,
    ...CardShadow,
  },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  heroValue: {
    color: Brand.white,
    fontSize: 28,
    fontWeight: '700',
    marginTop: Space.sm,
    letterSpacing: -0.5,
  },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: Space.lg },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
  },
  heroPillText: { color: Brand.white, fontSize: 11, fontWeight: '600' },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.lg,
    marginTop: Space.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
  },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: Brand.text },
  cardJobs: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.primary,
    backgroundColor: Brand.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    gap: Space.md,
  },
  rowLabel: { fontSize: 12.5, color: Brand.textSecondary },
  rowValue: { fontSize: 12.5, color: Brand.text, fontWeight: '600' },
  strong: { fontSize: 13, fontWeight: '700', color: Brand.text },
  strongValue: { fontSize: 15, fontWeight: '700', color: Brand.green },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.divider, marginVertical: Space.sm },
  note: { fontSize: 11, color: Brand.textMuted, marginTop: Space.lg, lineHeight: 16 },
  walletCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.lg,
    marginBottom: Space.md,
    ...CardShadow,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Space.md,
  },
  walletCopy: { flex: 1 },
  walletLabel: { fontSize: 11.5, color: Brand.textMuted, fontWeight: '600' },
  walletValue: {
    fontSize: 26,
    fontWeight: '700',
    color: Brand.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  walletBadge: {
    backgroundColor: Brand.greenSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  walletBadgeText: { fontSize: 10, fontWeight: '700', color: Brand.green },
  walletDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Brand.divider,
    marginVertical: Space.md,
  },
  walletMetaRow: { flexDirection: 'row', gap: Space.md },
  walletMetaItem: { flex: 1 },
  walletMetaLabel: { fontSize: 10.5, color: Brand.textMuted, fontWeight: '600' },
  walletMetaValue: { fontSize: 13, fontWeight: '700', color: Brand.text, marginTop: 2 },
  walletActions: { flexDirection: 'row', gap: Space.sm, marginTop: Space.lg },
  walletAction: { flex: 1 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.xxl,
    marginBottom: Space.md,
  },
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
  statusChip: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  statusChipText: { fontSize: 10.5, fontWeight: '700' },
});
