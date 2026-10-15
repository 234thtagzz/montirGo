import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { formatIDR } from '@/utils/format';
import { getEarningsSummary, type EarningsSummary } from '@/features/mechanic/service';
import { LoadingState } from '@/components/ui/state';

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
  const [day, setDay] = useState<EarningsSummary>({ totalJobs: 0, gross: 0, fee: 0, net: 0 });
  const [week, setWeek] = useState<EarningsSummary>({ totalJobs: 0, gross: 0, fee: 0, net: 0 });
  const [month, setMonth] = useState<EarningsSummary>({ totalJobs: 0, gross: 0, fee: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    } catch (e) {
      Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Coba lagi.');
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
      } catch (e) {
        if (!cancelled) Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Coba lagi.');
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

  if (loading) {
    return <LoadingState message="Memuat pendapatan..." />;
  }

  const sections: { label: string; s: EarningsSummary }[] = [
    { label: 'Hari ini', s: day },
    { label: 'Minggu ini', s: week },
    { label: 'Bulan ini', s: month },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }>
      <Text style={styles.title}>Pendapatan</Text>
      {sections.map(({ label, s }) => (
        <View key={label} style={styles.card}>
          <Text style={styles.cardTitle}>{label} • {s.totalJobs} job</Text>
          <View style={styles.row}>
            <Text style={styles.muted}>Gross</Text>
            <Text style={styles.value}>{formatIDR(s.gross)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.muted}>Fee platform</Text>
            <Text style={styles.value}>{formatIDR(s.fee)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.net}>Bersih</Text>
            <Text style={styles.net}>{formatIDR(s.net)}</Text>
          </View>
        </View>
      ))}
      <Text style={styles.note}>Dihitung dari tabel earnings (diisi backend saat pembayaran terverifikasi, PRD §18).</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  muted: { fontSize: 13, color: '#60646c' },
  card: { backgroundColor: '#f5f5f7', borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  value: { fontSize: 14, color: '#1a1a1a' },
  net: { fontSize: 15, fontWeight: '700', color: '#16a34a', marginTop: 4 },
  note: { fontSize: 12, color: '#9ca3af', marginBottom: 32 },
});
