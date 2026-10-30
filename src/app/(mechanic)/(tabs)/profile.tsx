import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { useAuth } from '@/features/auth/service';
import { useSessionUser } from '@/hooks/use-session-user';
import {
  getMechanicProfile,
  setOnlineStatus,
  updateMechanicProfile,
  type MechanicProfile,
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
        skills: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
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

  const handleLogout = () => {
    Alert.alert('Keluar dari akun?', 'Kamu perlu login kembali untuk menerima order.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert('Gagal', error instanceof Error ? error.message : 'Gagal keluar.');
          }
        },
      },
    ]);
  };

  if (loading || sessionLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Profil" showBack={false} />
        <LoadingState message="Memuat profil..." />
      </View>
    );
  }

  const name = sessionUser?.fullName || 'Montir MontirGo';
  const verified = profile?.is_verified ?? false;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profil" showBack={false} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identity}>
            <Avatar name={name} size={60} />
            <View style={styles.identityCopy}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {sessionUser?.email ?? '-'}
              </Text>
              <View style={styles.badges}>
                <View style={styles.roleBadge}>
                  <Ionicons name="construct" size={11} color={Brand.primary} />
                  <Text style={styles.roleText}>Akun Montir</Text>
                </View>
                <View style={[styles.verifyBadge, verified ? styles.verifyOk : styles.verifyPending]}>
                  <Ionicons
                    name={verified ? 'shield-checkmark' : 'alert-circle-outline'}
                    size={11}
                    color={verified ? Brand.green : Brand.amber}
                  />
                  <Text
                    style={[
                      styles.verifyText,
                      { color: verified ? Brand.green : Brand.amber },
                    ]}
                  >
                    {verified ? 'Terverifikasi' : 'Belum verifikasi'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <View style={styles.statIcon}>
                <Ionicons name="star" size={16} color={Brand.amber} />
              </View>
              <Text style={styles.statValue}>{Number(profile?.rating_avg ?? 0).toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.stat}>
              <View style={styles.statIcon}>
                <Ionicons name="checkmark-done-outline" size={16} color={Brand.green} />
              </View>
              <Text style={styles.statValue}>{profile?.total_jobs ?? 0}</Text>
              <Text style={styles.statLabel}>Job selesai</Text>
            </View>
          </View>

          <View style={styles.onlineCard}>
            <View style={[styles.onlineIcon, online && styles.onlineIconActive]}>
              <Ionicons
                name="power-outline"
                size={19}
                color={online ? Brand.primary : Brand.textSecondary}
              />
            </View>
            <View style={styles.onlineCopy}>
              <Text style={styles.onlineTitle}>{online ? 'Online' : 'Offline'}</Text>
              <Text style={styles.onlineSub}>
                {online ? 'Siap menerima order' : 'Tidak menerima order'}
              </Text>
            </View>
            <Switch
              value={online}
              onValueChange={toggleOnline}
              trackColor={{ false: Brand.border, true: Brand.primary }}
              thumbColor={Brand.white}
              ios_backgroundColor={Brand.border}
            />
          </View>

          <Text style={styles.section}>Kelola bengkel</Text>
          <View style={styles.formCard}>
            <Field
              label="Nama bengkel"
              value={workshop}
              onChangeText={setWorkshop}
              placeholder="Contoh: Bengkel Berkah Jaya"
            />
            <Field
              label="Keahlian"
              value={skills}
              onChangeText={setSkills}
              placeholder="Contoh: tune-up, ganti oli, kelistrikan"
              helper="Pisahkan tiap keahlian dengan koma."
            />
          </View>

          <Button
            label="Simpan Profil"
            icon="save-outline"
            loading={saving}
            onPress={handleSave}
            style={styles.save}
          />

          <Button
            label="Keluar"
            variant="danger"
            icon="log-out-outline"
            onPress={handleLogout}
            style={styles.logout}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  helper,
  ...inputProps
}: { label: string; helper?: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={Brand.textMuted}
        selectionColor={Brand.primary}
        style={styles.input}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  identityCopy: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', color: Brand.text },
  email: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Space.sm },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primarySoft,
  },
  roleText: { fontSize: 10.5, fontWeight: '700', color: Brand.primary },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  verifyOk: { backgroundColor: Brand.greenSoft },
  verifyPending: { backgroundColor: Brand.amberSoft },
  verifyText: { fontSize: 10.5, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: Space.md, marginTop: Space.md },
  stat: {
    flex: 1,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: Brand.text, marginTop: Space.sm },
  statLabel: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  onlineIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIconActive: { backgroundColor: Brand.primarySoft },
  onlineCopy: { flex: 1 },
  onlineTitle: { fontSize: 14.5, fontWeight: '700', color: Brand.text },
  onlineSub: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.xxl,
    marginBottom: Space.md,
  },
  formCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.lg,
  },
  field: { marginBottom: Space.lg },
  label: { fontSize: 12.5, fontWeight: '700', color: Brand.text, marginBottom: Space.sm },
  input: {
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    minHeight: 48,
    fontSize: 13.5,
    color: Brand.text,
  },
  helper: { fontSize: 10.5, color: Brand.textMuted, marginTop: 5 },
  save: { marginTop: Space.xxl },
  logout: { marginTop: Space.md },
});
