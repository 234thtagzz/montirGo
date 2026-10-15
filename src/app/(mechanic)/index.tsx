import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, RefreshControl, Alert, Switch,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  getEarningsSummary, getMechanicProfile, listMyOrders,
  setOnlineStatus, type MyOrder,
} from '@/features/mechanic/service';
import { formatIDR } from '@/utils/format';

import { LoadingState } from '@/components/ui/state';
import { useSessionUser } from '@/hooks/use-session-user';

export default function MechanicDashboardScreen() {
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const [online, setOnline] = useState(false);
  const [verified, setVerified] = useState(false);
  const [todayNet, setTodayNet] = useState(0);
  const [todayJobs, setTodayJobs] = useState(0);
  const [activeOrders, setActiveOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const profile = await getMechanicProfile();
      setOnline(profile?.is_online ?? false);
      setVerified(profile?.is_verified ?? false);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const sum = await getEarningsSummary(startOfDay.toISOString());
      setTodayNet(sum.net);
      setTodayJobs(sum.totalJobs);
      setActiveOrders(await listMyOrders(true));
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
        const profile = await getMechanicProfile();
        if (cancelled) return;
        setOnline(profile?.is_online ?? false);
        setVerified(profile?.is_verified ?? false);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const sum = await getEarningsSummary(startOfDay.toISOString());
        if (cancelled) return;
        setTodayNet(sum.net);
        setTodayJobs(sum.totalJobs);
        setActiveOrders(await listMyOrders(true));
      } catch (e) {
        if (!cancelled) Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Coba lagi.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    // Realtime: order baru / perubahan status langsung refresh dashboard.
    const ch = supabase
      .channel('mechanic-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [load]);

  const toggleOnline = async (value: boolean) => {
    setOnline(value);
    try {
      await setOnlineStatus(value);
    } catch (e) {
      setOnline(!value);
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Tidak bisa mengubah status.');
    }
  };

  if (loading || sessionLoading) {
    return <LoadingState message="Memuat dashboard..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <Text style={styles.greeting}>Halo, {sessionUser?.fullName || sessionUser?.email || 'Montir'}!</Text>
      {!verified && (
        <Text style={styles.warn}>Akun belum terverifikasi admin. Kamu tetap bisa menerima order.</Text>
      )}

      {/* Primary CTA: Online / Siap Menerima Order (PRD §8) */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.cardTitle}>{online ? 'Online' : 'Offline'}</Text>
            <Text style={styles.muted}>{online ? 'Siap menerima order' : 'Tidak menerima order'}</Text>
          </View>
          <Switch value={online} onValueChange={toggleOnline} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatIDR(todayNet)}</Text>
          <Text style={styles.muted}>Bersih hari ini</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{todayJobs}</Text>
          <Text style={styles.muted}>Job hari ini</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{activeOrders.length}</Text>
          <Text style={styles.muted}>Order aktif</Text>
        </View>
      </View>

      <Text style={styles.section}>Order Aktif</Text>
      {activeOrders.length === 0 ? (
        <Text style={styles.muted}>Belum ada order aktif. Nyalakan status online untuk menerima request.</Text>
      ) : (
        activeOrders.map((o) => (
          <Pressable
            key={o.id}
            style={styles.card}
            onPress={() => router.push(`/(mechanic)/active-order/${o.id}`)}>
            <Text style={styles.cardTitle} numberOfLines={1}>{o.issue_description}</Text>
            <Text style={styles.muted}>{o.client_name ?? 'Client'} • {o.status.replaceAll('_', ' ')}</Text>
          </Pressable>
        ))
      )}

      <View style={styles.actions}>
        <Link href="/(mechanic)/requests" asChild>
          <Pressable style={styles.button}><Text style={styles.buttonText}>Lihat Request Masuk</Text></Pressable>
        </Link>
        <Link href="/(mechanic)/earnings" asChild>
          <Pressable style={styles.ghost}><Text style={styles.ghostText}>Rincian Pendapatan</Text></Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  warn: { color: '#a16207', backgroundColor: '#fef9c3', padding: 10, borderRadius: 10, marginVertical: 8, fontSize: 13 },
  card: { backgroundColor: '#f5f5f7', borderRadius: 14, padding: 16, marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  muted: { fontSize: 13, color: '#60646c', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  stat: { flex: 1, backgroundColor: '#eef4ff', borderRadius: 14, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  section: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 12 },
  actions: { gap: 10, marginVertical: 16, paddingBottom: 32 },
  button: { backgroundColor: '#3c87f7', padding: 15, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ghost: { borderWidth: 1, borderColor: '#3c87f7', padding: 15, borderRadius: 12, alignItems: 'center' },
  ghostText: { color: '#3c87f7', fontSize: 15, fontWeight: '600' },
});
