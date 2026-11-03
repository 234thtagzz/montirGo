import {
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { useAuth } from '@/features/auth/service';
import { useSessionUser } from '@/hooks/use-session-user';
import { formatDateTime } from '@/utils/format';
import {
  getMechanicProfile,
  getMyProfileRow,
  listMechanicReviews,
  setOnlineStatus,
  updateMechanicProfile,
  updateMyProfileIdentity,
  type MechanicProfile,
  type MechanicReview,
} from '@/features/mechanic/service';
import { pickMechanicPhoto, uploadMechanicAvatar } from '@/features/mechanic/photo';

type CertificationDraft = {
  key: string;
  title: string;
  issuer: string;
  year: string;
};

function makeKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Sertifikasi tersimpan sebagai satu baris teks: "Nama — Penerbit (2024)". */
function parseCertification(value: string): CertificationDraft {
  const text = value.trim();
  const yearMatch = text.match(/\((\d{4})\)\s*$/);
  const year = yearMatch ? yearMatch[1] : '';
  const withoutYear = yearMatch ? text.slice(0, yearMatch.index).trim() : text;

  const dashIndex = withoutYear.indexOf('—');
  if (dashIndex === -1) {
    return { key: makeKey(), title: withoutYear, issuer: '', year };
  }
  return {
    key: makeKey(),
    title: withoutYear.slice(0, dashIndex).trim(),
    issuer: withoutYear.slice(dashIndex + 1).trim(),
    year,
  };
}

function formatCertification(draft: CertificationDraft): string {
  const title = draft.title.trim();
  const issuer = draft.issuer.trim();
  const year = draft.year.trim();
  if (!issuer && !year) return title;
  const detail = [issuer, year ? `(${year})` : ''].filter(Boolean).join(' ');
  return `${title} — ${detail}`;
}

export default function MechanicProfileScreen() {
  const { logout } = useAuth();
  const { user: sessionUser, loading: sessionLoading } = useSessionUser();
  const router = useRouter();

  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [workshop, setWorkshop] = useState('');
  const [workshopAddress, setWorkshopAddress] = useState('');
  const [skills, setSkills] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [certifications, setCertifications] = useState<CertificationDraft[]>([]);
  const [reviews, setReviews] = useState<MechanicReview[]>([]);

  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mechanic, identity, reviewRows] = await Promise.all([
        getMechanicProfile(),
        getMyProfileRow(),
        listMechanicReviews().catch(() => []),
      ]);

      setProfile(mechanic);
      setAvatarUrl(identity.avatar_url);
      setFullName(identity.full_name ?? '');
      setPhone(identity.phone_number ?? '');
      setBio(mechanic?.bio ?? '');
      setExperience(mechanic?.experience_years?.toString() ?? '');
      setWorkshop(mechanic?.workshop_name ?? '');
      setWorkshopAddress(mechanic?.workshop_address ?? '');
      setSkills((mechanic?.skills ?? []).join(', '));
      setSpecializations((mechanic?.vehicle_specialization ?? []).join(', '));
      setCertifications((mechanic?.certifications ?? []).map(parseCertification));
      setOnline(mechanic?.is_online ?? false);
      setReviews(reviewRows);
    } catch (error) {
      Alert.alert('Gagal memuat', error instanceof Error ? error.message : 'Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Dijadwalkan agar pemuatan data tidak memicu setState sinkron di body effect.
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const toggleOnline = async (value: boolean) => {
    setOnline(value);
    try {
      await setOnlineStatus(value);
    } catch (error) {
      setOnline(!value);
      Alert.alert('Gagal', error instanceof Error ? error.message : 'Tidak bisa mengubah status.');
    }
  };

  const pickAvatar = async () => {
    if (!sessionUser?.id || uploadingAvatar) return;
    try {
      const photo = await pickMechanicPhoto([1, 1]);
      if (!photo) return;
      setUploadingAvatar(true);
      const url = await uploadMechanicAvatar(sessionUser.id, photo);
      await updateMyProfileIdentity({ avatar_url: url });
      setAvatarUrl(url);
      Alert.alert('Berhasil', 'Foto profil montir diperbarui.');
    } catch (error) {
      Alert.alert('Gagal', error instanceof Error ? error.message : 'Coba lagi.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Gagal', 'Nama lengkap wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        updateMyProfileIdentity({
          full_name: fullName.trim(),
          phone_number: phone.trim() || null,
        }),
        updateMechanicProfile({
          bio: bio.trim() || null,
          experience_years: parseNumber(experience),
          workshop_name: workshop.trim() || null,
          workshop_address: workshopAddress.trim() || null,
          skills: splitList(skills),
          vehicle_specialization: splitList(specializations),
          certifications: certifications
            .filter((cert) => cert.title.trim())
            .map(formatCertification),
        }),
      ]);
      Alert.alert('Berhasil', 'Profil montir tersimpan.');
      await load();
    } catch (error) {
      Alert.alert('Gagal menyimpan', error instanceof Error ? error.message : 'Coba lagi.');
    } finally {
      setSaving(false);
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

  const addCertification = () => {
    setCertifications((current) => [
      ...current,
      { key: makeKey(), title: '', issuer: '', year: '' },
    ]);
  };

  const updateCertification = (key: string, patch: Partial<CertificationDraft>) => {
    setCertifications((current) =>
      current.map((cert) => (cert.key === key ? { ...cert, ...patch } : cert)),
    );
  };

  const removeCertification = (key: string) => {
    setCertifications((current) => current.filter((cert) => cert.key !== key));
  };

  if (loading || sessionLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Profil Montir" showBack={false} />
        <LoadingState message="Memuat profil montir..." />
      </View>
    );
  }

  const name = fullName.trim() || sessionUser?.fullName || 'Montir MontirGo';
  const verified = profile?.is_verified ?? false;
  const rating = Number(profile?.rating_avg ?? 0);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profil Montir" showBack={false} />
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ganti foto profil"
              disabled={uploadingAvatar}
              onPress={pickAvatar}
              style={styles.avatarWrap}
            >
              <Avatar name={name} uri={avatarUrl} size={64} />
              <View style={styles.avatarEdit}>
                <Ionicons
                  name={uploadingAvatar ? 'hourglass-outline' : 'camera'}
                  size={12}
                  color={Brand.white}
                />
              </View>
            </Pressable>
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
                <View
                  style={[styles.verifyBadge, verified ? styles.verifyOk : styles.verifyPending]}
                >
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
            <Stat
              icon="star"
              iconColor={Brand.amber}
              value={rating.toFixed(1)}
              label="Rating"
            />
            <Stat
              icon="chatbubble-ellipses-outline"
              iconColor={Brand.primary}
              value={(profile?.rating_count ?? 0).toString()}
              label="Ulasan"
            />
            <Stat
              icon="checkmark-done-outline"
              iconColor={Brand.green}
              value={(profile?.total_jobs ?? 0).toString()}
              label="Job selesai"
            />
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

          <Section icon="person-outline" title="Identitas montir">
            <Field label="Nama lengkap" value={fullName} onChangeText={setFullName} />
            <Field
              label="Nomor WhatsApp"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="08xx xxxx xxxx"
            />
            <Field
              label="Tentang saya"
              value={bio}
              onChangeText={setBio}
              placeholder="Ceritakan pengalaman dan keahlian utamamu"
              multiline
            />
            <Field
              label="Pengalaman (tahun)"
              value={experience}
              onChangeText={setExperience}
              keyboardType="number-pad"
              placeholder="5"
            />
          </Section>

          <Section icon="business-outline" title="Data bengkel">
            <Field
              label="Nama bengkel"
              value={workshop}
              onChangeText={setWorkshop}
              placeholder="Contoh: Bengkel Berkah Jaya"
            />
            <Field
              label="Alamat bengkel"
              value={workshopAddress}
              onChangeText={setWorkshopAddress}
              placeholder="Jalan, nomor, kelurahan, kota"
              multiline
            />
          </Section>

          <Section icon="construct-outline" title="Keahlian">
            <Field
              label="Keahlian"
              value={skills}
              onChangeText={setSkills}
              placeholder="tune-up, ganti oli, kelistrikan"
              helper="Pisahkan tiap keahlian dengan koma."
            />
            <Field
              label="Spesialisasi kendaraan"
              value={specializations}
              onChangeText={setSpecializations}
              placeholder="motor matic, mobil bensin"
              helper="Pisahkan dengan koma."
            />
          </Section>

          <Section icon="ribbon-outline" title="Sertifikasi">
            {certifications.length === 0 ? (
              <Text style={styles.muted}>
                Belum ada sertifikasi. Tambahkan pelatihan atau sertifikat keahlianmu.
              </Text>
            ) : null}
            {certifications.map((cert, index) => (
              <View key={cert.key} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>Sertifikasi {index + 1}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus sertifikasi ${index + 1}`}
                    hitSlop={8}
                    onPress={() => removeCertification(cert.key)}
                  >
                    <Ionicons name="trash-outline" size={17} color={Brand.red} />
                  </Pressable>
                </View>
                <Field
                  label="Nama sertifikat"
                  value={cert.title}
                  onChangeText={(value) => updateCertification(cert.key, { title: value })}
                  placeholder="Teknisi Motor Bersertifikat"
                />
                <View style={styles.twoColumns}>
                  <View style={styles.column}>
                    <Field
                      label="Penerbit"
                      value={cert.issuer}
                      onChangeText={(value) => updateCertification(cert.key, { issuer: value })}
                      placeholder="BLK / lembaga"
                    />
                  </View>
                  <View style={styles.column}>
                    <Field
                      label="Tahun"
                      value={cert.year}
                      onChangeText={(value) => updateCertification(cert.key, { year: value })}
                      keyboardType="number-pad"
                      placeholder="2024"
                    />
                  </View>
                </View>
              </View>
            ))}
            <Button
              label="Tambah Sertifikasi"
              icon="add-circle-outline"
              variant="secondary"
              compact
              onPress={addCertification}
            />
          </Section>

          <Section icon="chatbubbles-outline" title="Ulasan client">
            {reviews.length === 0 ? (
              <Text style={styles.muted}>
                Belum ada ulasan. Rating akan muncul otomatis setelah client mengulas pesanan
                yang sudah lunas.
              </Text>
            ) : (
              reviews.map((review) => <ReviewRow key={review.id} review={review} />)
            )}
          </Section>

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

function Stat({
  icon,
  iconColor,
  value,
  label,
}: {
  icon: IconName;
  iconColor: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={15} color={Brand.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({
  label,
  helper,
  multiline,
  ...inputProps
}: { label: string; helper?: string; multiline?: boolean } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={Brand.textMuted}
        selectionColor={Brand.primary}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function ReviewRow({ review }: { review: MechanicReview }) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewTop}>
        <Text style={styles.reviewName} numberOfLines={1}>
          {review.reviewer_name ?? 'Client MontirGo'}
        </Text>
        <View style={styles.stars}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Ionicons
              key={index}
              name={index < review.rating ? 'star' : 'star-outline'}
              size={12}
              color={Brand.amber}
            />
          ))}
        </View>
      </View>
      <Text style={styles.reviewDate}>{formatDateTime(review.created_at)}</Text>
      {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
      {review.mechanic_reply ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Balasanmu</Text>
          <Text style={styles.replyText}>{review.mechanic_reply}</Text>
        </View>
      ) : null}
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
  avatarWrap: { position: 'relative' },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Brand.primary,
    borderWidth: 2,
    borderColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
  statsRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
  stat: {
    flex: 1,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '700', color: Brand.text, marginTop: Space.sm },
  statLabel: { fontSize: 10.5, color: Brand.textSecondary, marginTop: 2 },
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
  sectionBlock: { marginTop: Space.xxl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginBottom: Space.md,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14.5, fontWeight: '700', color: Brand.text },
  sectionCard: {
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
  inputMultiline: { minHeight: 78, paddingTop: Space.md, textAlignVertical: 'top' },
  helper: { fontSize: 10.5, color: Brand.textMuted, marginTop: 5 },
  twoColumns: { flexDirection: 'row', gap: Space.md },
  column: { flex: 1 },
  muted: { fontSize: 11.5, color: Brand.textSecondary, lineHeight: 17, marginBottom: Space.md },
  itemCard: {
    borderWidth: 1,
    borderColor: Brand.divider,
    borderRadius: Radius.md,
    padding: Space.md,
    marginBottom: Space.md,
    backgroundColor: '#FCFDFF',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  itemTitle: { fontSize: 12.5, fontWeight: '700', color: Brand.text },
  reviewRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
    paddingVertical: Space.md,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  reviewName: { flex: 1, fontSize: 12.5, fontWeight: '700', color: Brand.text },
  stars: { flexDirection: 'row', gap: 1 },
  reviewDate: { fontSize: 10, color: Brand.textMuted, marginTop: 2 },
  reviewComment: {
    fontSize: 11.5,
    color: Brand.textSecondary,
    lineHeight: 17,
    marginTop: Space.sm,
  },
  replyBox: {
    marginTop: Space.sm,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.sm,
    padding: Space.sm,
  },
  replyLabel: { fontSize: 10, fontWeight: '700', color: Brand.primary },
  replyText: { fontSize: 11, color: Brand.text, marginTop: 2, lineHeight: 16 },
  save: { marginTop: Space.xxl },
  logout: { marginTop: Space.md },
});
