import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/service';
import { useSessionUser } from '@/hooks/use-session-user';
import { LoadingState } from '@/components/ui/state';
import {
  getMechanicProfile, setOnlineStatus, updateMechanicProfile, type MechanicProfile,
} from '@/features/mechanic/service';

export default function MechanicProfileScreen() {
  const { logout } = useAuth();
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const router = useRouter();
  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [workshop, setWorkshop] = useState('');
  const [skills, setSkills] = useState('');
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await getMechanicProfile();
      setProfile(p);
      setWorkshop(p?.workshop_name ?? '');
      setSkills((p?.skills ?? []).join(', '));
      setOnline(p?.is_online ?? false);
    } catch (e) {
      Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getMechanicProfile();
        if (cancelled) return;
        setProfile(p);
        setWorkshop(p?.workshop_name ?? '');
        setSkills((p?.skills ?? []).join(', '));
        setOnline(p?.is_online ?? false);
      } catch (e) {
        if (!cancelled) Alert.alert('Gagal memuat', e instanceof Error ? e.message : 'Coba lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMechanicProfile({
        workshop_name: workshop.trim() || undefined,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      Alert.alert('Berhasil', 'Profil bengkel tersimpan.');
      load();
    } catch (e) {
      Alert.alert('Gagal menyimpan', e instanceof Error ? e.message : 'Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const toggleOnline = async (value: boolean) => {
    setOnline(value);
    try {
      await setOnlineStatus(value);
    } catch (e) {
      setOnline(!value);
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Tidak bisa mengubah status.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      Alert.alert('Gagal', error instanceof Error ? error.message : 'Gagal keluar');
      return;
    }
    router.replace('/(auth)/login');
  };

  if (loading || sessionLoading) {
    return <LoadingState message="Memuat profil..." />;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Profil Montir</Text>
      <Text style={styles.muted}>{sessionUser?.email}</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Rating: {Number(profile?.rating_avg ?? 0).toFixed(1)} ⭐</Text>
          <Text style={styles.muted}>{profile?.total_jobs ?? 0} job selesai</Text>
        </View>
        <Text style={styles.muted}>
          Status verifikasi: {profile?.is_verified ? 'Terverifikasi' : 'Belum verifikasi'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>{online ? 'Online' : 'Offline'}</Text>
          <Switch value={online} onValueChange={toggleOnline} />
        </View>
      </View>

      <Text style={styles.label}>Nama Bengkel</Text>
      <TextInput
        value={workshop}
        onChangeText={setWorkshop}
        placeholder="cth: Bengkel Berkah Jaya"
        style={styles.input}
      />
      <Text style={styles.label}>Keahlian (pisahkan koma)</Text>
      <TextInput
        value={skills}
        onChangeText={setSkills}
        placeholder="cth: tune-up, ganti oli, kelistrikan"
        style={styles.input}
      />
      <Pressable style={styles.button} disabled={saving} onPress={handleSave}>
        <Text style={styles.buttonText}>{saving ? 'Menyimpan...' : 'Simpan Profil'}</Text>
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Keluar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 56 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  muted: { fontSize: 13, color: '#60646c', marginTop: 4 },
  card: { backgroundColor: '#f5f5f7', borderRadius: 14, padding: 16, marginVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  label: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#f5f5f7', borderRadius: 12, paddingHorizontal: 16,
    height: 50, fontSize: 15, color: '#1a1a1a',
  },
  button: { backgroundColor: '#3c87f7', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logoutButton: {
    backgroundColor: '#fde8ea', padding: 15, borderRadius: 12,
    alignItems: 'center', marginTop: 12, marginBottom: 32,
  },
  logoutText: { color: '#e8112a', fontSize: 15, fontWeight: '600' },
});
