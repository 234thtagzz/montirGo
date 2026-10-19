import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ErrorState, LoadingState } from '@/components/ui/state';
import { Brand, CardShadow, Gradient, Radius, ScreenPadding, Space } from '@/constants/brand';
import { getEarningsSummary, type EarningsSummary } from '@/features/mechanic/service';
import { formatIDR } from '@/utils/format';

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
  const [day, setDay] = useState<EarningsSummary>(ZERO);
  const [week, setWeek] = useState<EarningsSummary>(ZERO);
  const [month, setMonth] = useState<EarningsSummary>(ZERO);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, w, m] = await Promise.all([
        getEarningsSummary(startOf('day')),
        getEarningsSummary(startOf('week')),
        getEarningsSummary(startOf('month')),
      ]);
      setDay(d);
      setWeek(w);
      setMonth(m);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, w, m] = await Promise.all([
          getEarningsSummary(startOf('day')),
          getEarningsSummary(startOf('week')),
          getEarningsSummary(startOf('month')),
        ]);
        if (cancelled) return;
        setDay(d);
        setWeek(w);
        setMonth(m);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
});
