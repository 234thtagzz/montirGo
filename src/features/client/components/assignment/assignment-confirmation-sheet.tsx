import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space, Tabular, Type } from '@/constants/brand';
import {
  listMechanicReviews,
  getMechanicAssignmentProfile,
  respondToAssignment,
  type AssignmentDecision,
  type ClientOrder,
  type ClientReview,
  type MechanicAssignmentProfile,
} from '@/features/client/service';
import { resolveWorkshopPhotoUrls } from '@/features/mechanic/photo';
import { formatSpecializations } from '@/features/mechanic/specializations';
import { formatDateTime } from '@/utils/format';

interface AssignmentConfirmationSheetProps {
  visible: boolean;
  order: ClientOrder;
  /** Dipanggil setelah keputusan berhasil disimpan ke database. */
  onResolved: (decision: AssignmentDecision) => Promise<void> | void;
  /** Muat ulang pesanan bila pengajuan sudah kedaluwarsa. */
  onRefresh: () => void;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Lembar konfirmasi montir di sisi client.
 *
 * Client melihat ringkasan identitas, rating, ulasan, dan bengkel montir
 * sebelum order boleh berlanjut ke status `mechanic_accepted`. Lembar ini
 * sengaja tidak bisa ditutup lewat backdrop: client harus memilih salah satu
 * keputusan, atau menunggu pengajuan kedaluwarsa.
 */
export function AssignmentConfirmationSheet({
  visible,
  order,
  onResolved,
  onRefresh,
}: AssignmentConfirmationSheetProps) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<MechanicAssignmentProfile | null>(null);
  const [reviews, setReviews] = useState<ClientReview[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<AssignmentDecision | null>(null);
  const [now, setNow] = useState(0);

  const mechanicId = order.mechanic_id;
  const expiresAt = order.assignment_expires_at
    ? new Date(order.assignment_expires_at).getTime()
    : null;

  const load = useCallback(async () => {
    if (!mechanicId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, nextReviews] = await Promise.all([
        getMechanicAssignmentProfile(mechanicId),
        listMechanicReviews(mechanicId, 3).catch(() => []),
      ]);
      setProfile(nextProfile);
      setReviews(nextReviews);

      if (nextProfile?.workshop_photo) {
        const urls = await resolveWorkshopPhotoUrls([nextProfile.workshop_photo]);
        setPhotoUrl(urls[nextProfile.workshop_photo] ?? null);
      } else {
        setPhotoUrl(null);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Profil montir gagal dimuat. Periksa koneksi lalu coba lagi.',
      );
    } finally {
      setLoading(false);
    }
  }, [mechanicId]);

  useEffect(() => {
    if (!visible) return;
    // Ditunda satu tick agar pemuatan tidak memicu setState di badan effect.
    const start = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(start);
  }, [visible, load]);

  useEffect(() => {
    if (!visible) return;
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [visible]);

  const remainingMs = expiresAt == null || now === 0 ? null : Math.max(0, expiresAt - now);
  const expired = remainingMs != null && remainingMs <= 0;

  const specialization = useMemo(
    () => formatSpecializations(profile?.vehicle_specialization),
    [profile?.vehicle_specialization],
  );
  const skills = useMemo(
    () => (profile?.skills ?? []).filter(Boolean).join(' · '),
    [profile?.skills],
  );

  const runDecision = async (decision: AssignmentDecision) => {
    if (responding || expired) return;
    setResponding(decision);
    try {
      await respondToAssignment(order.id, decision);
      await onResolved(decision);
    } catch (e) {
      Alert.alert('Gagal', e instanceof Error ? e.message : 'Coba lagi.');
      // Status mungkin sudah berubah di server (mis. kedaluwarsa/ ditolak).
      onRefresh();
    } finally {
      setResponding(null);
    }
  };

  const confirmReject = () => {
    Alert.alert(
      'Tolak montir ini?',
      'Pesanan akan kembali ke kolam dan montir lain bisa mengajukan diri.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tolak montir',
          style: 'destructive',
          onPress: () => void runDecision('reject'),
        },
      ],
    );
  };

  const confirmCancel = () => {
    Alert.alert(
      'Tolak & batalkan pesanan?',
      'Pesanan akan dibatalkan dan tidak bisa dilanjutkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Batalkan pesanan',
          style: 'destructive',
          onPress: () => void runDecision('reject_and_cancel'),
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        // Konfirmasi bersifat wajib; client harus memilih keputusan.
      }}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Space.lg) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>KONFIRMASI MONTIR</Text>
              <Text style={styles.title}>Montir ingin menangani pesananmu</Text>
              <Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            {remainingMs != null ? (
              <View style={[styles.countdown, expired && styles.countdownExpired]}>
                <Ionicons
                  name={expired ? 'alert-circle-outline' : 'time-outline'}
                  size={13}
                  color={expired ? Brand.red : Brand.amber}
                />
                <Text style={[styles.countdownText, expired && styles.countdownTextExpired]}>
                  {expired ? 'Kedaluwarsa' : formatRemaining(remainingMs)}
                </Text>
              </View>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={Brand.primary} />
              <Text style={styles.stateText}>Memuat profil montir…</Text>
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <Ionicons name="cloud-offline-outline" size={28} color={Brand.textMuted} />
              <Text style={styles.stateTitle}>Profil gagal dimuat</Text>
              <Text style={styles.stateText}>{error}</Text>
              <Button label="Coba Lagi" variant="secondary" compact onPress={load} />
            </View>
          ) : profile ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.identityCard}>
                <View style={styles.identityAvatar}>
                  <Avatar
                    name={profile.full_name ?? 'Montir'}
                    uri={profile.avatar_url}
                    size={52}
                  />
                </View>
                <View style={styles.identityCopy}>
                  <Text style={styles.identityEyebrow}>MONTIR YANG MENGAJUKAN DIRI</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {profile.full_name?.trim() || 'Montir MontirGo'}
                  </Text>
                  <View
                    style={[
                      styles.verifyBadge,
                      profile.is_verified ? styles.verifyOk : styles.verifyPending,
                    ]}
                  >
                    <Ionicons
                      name={profile.is_verified ? 'shield-checkmark' : 'alert-circle-outline'}
                      size={11}
                      color={profile.is_verified ? Brand.volt : '#FCD34D'}
                    />
                    <Text
                      style={[
                        styles.verifyText,
                        { color: profile.is_verified ? Brand.volt : '#FCD34D' },
                      ]}
                    >
                      {profile.is_verified ? 'Terverifikasi' : 'Belum verifikasi'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.statsRow}>
                <Stat
                  value={Number(profile.rating_avg ?? 0).toFixed(1)}
                  label="Rating"
                  icon="star"
                  color={Brand.amber}
                />
                <Stat
                  value={String(profile.rating_count ?? 0)}
                  label="Ulasan"
                  icon="chatbubble-ellipses-outline"
                  color={Brand.primary}
                />
                <Stat
                  value={String(profile.total_jobs ?? 0)}
                  label="Job selesai"
                  icon="checkmark-done-outline"
                  color={Brand.green}
                />
              </View>

              {profile.bio?.trim() ? (
                <Text style={styles.bio}>{profile.bio.trim()}</Text>
              ) : null}

              <Section icon="person-outline" title="Data montir">
                {profile.experience_years ? (
                  <InfoRow
                    icon="briefcase-outline"
                    label="Pengalaman"
                    value={`${profile.experience_years} tahun`}
                  />
                ) : null}
                {specialization ? (
                  <InfoRow
                    icon="car-sport-outline"
                    label="Spesialisasi"
                    value={specialization}
                  />
                ) : null}
                {skills ? <InfoRow icon="construct-outline" label="Keahlian" value={skills} /> : null}
                {profile.certifications?.length ? (
                  <InfoRow
                    icon="ribbon-outline"
                    label="Sertifikasi"
                    value={profile.certifications.join('\n')}
                  />
                ) : null}
                {!profile.experience_years &&
                !specialization &&
                !skills &&
                !profile.certifications?.length ? (
                  <Text style={styles.muted}>
                    Montir belum melengkapi pengalaman dan keahliannya.
                  </Text>
                ) : null}
              </Section>

              <Section icon="business-outline" title="Data bengkel">
                {photoUrl ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.workshopPhoto}
                    contentFit="cover"
                    transition={150}
                  />
                ) : null}
                <Text style={styles.workshopName}>
                  {profile.workshop_name?.trim() || 'Montir panggilan'}
                </Text>
                <Text style={styles.workshopAddress}>
                  {profile.workshop_address?.trim() || 'Belum mengisi alamat bengkel'}
                </Text>
              </Section>

              <Section icon="chatbubbles-outline" title="Ulasan client">
                {reviews.length === 0 ? (
                  <Text style={styles.muted}>
                    Belum ada ulasan. Rating akan muncul setelah client mengulas pesanan
                    yang sudah lunas.
                  </Text>
                ) : (
                  reviews.map((review) => <ReviewRow key={review.id} review={review} />)
                )}
              </Section>
            </ScrollView>
          ) : (
            <View style={styles.stateBox}>
              <Ionicons name="person-outline" size={28} color={Brand.textMuted} />
              <Text style={styles.stateTitle}>Profil montir tidak tersedia</Text>
              <Text style={styles.stateText}>
                Montir mungkin sudah tidak terhubung dengan pesanan ini.
              </Text>
            </View>
          )}

          {expired ? (
            <View style={styles.expiredBox}>
              <Ionicons name="time-outline" size={16} color={Brand.red} />
              <Text style={styles.expiredText}>
                Waktu konfirmasi habis. Pesanan akan kembali mencari montir.
              </Text>
              <Button label="Muat Ulang" variant="secondary" compact onPress={onRefresh} />
            </View>
          ) : (
            <View style={styles.actions}>
              <Button
                label="Konfirmasi Montir"
                icon="checkmark-circle-outline"
                loading={responding === 'accept'}
                disabled={loading || !!error || !profile || responding !== null}
                onPress={() => void runDecision('accept')}
              />
              <Button
                label="Tolak & kembalikan ke kolam"
                icon="refresh-outline"
                variant="ghost"
                loading={responding === 'reject'}
                disabled={loading || !!error || responding !== null}
                onPress={confirmReject}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tolak dan batalkan pesanan"
                disabled={loading || !!error || responding !== null}
                onPress={confirmCancel}
                style={({ pressed }) => [styles.cancelLink, pressed && styles.pressed]}
              >
                <Text style={styles.cancelText}>
                  {responding === 'reject_and_cancel'
                    ? 'Membatalkan pesanan…'
                    : 'Tolak & batalkan pesanan'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Stat({
  value,
  label,
  icon,
  color,
}: {
  value: string;
  label: string;
  icon: 'star' | 'chatbubble-ellipses-outline' | 'checkmark-done-outline';
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLabelRow}>
        <Ionicons name={icon} size={11} color={color} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, Tabular]}>{value}</Text>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: 'person-outline' | 'business-outline' | 'chatbubbles-outline';
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={14} color={Brand.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: 'briefcase-outline' | 'car-sport-outline' | 'construct-outline' | 'ribbon-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color={Brand.textMuted} style={styles.infoIcon} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: ClientReview }) {
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
              size={11}
              color={Brand.amber}
            />
          ))}
        </View>
      </View>
      <Text style={styles.reviewDate}>{formatDateTime(review.created_at)}</Text>
      {review.comment ? (
        <Text style={styles.reviewComment} numberOfLines={4}>
          {review.comment}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: Brand.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Space.sm,
    paddingHorizontal: Space.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.border,
    marginBottom: Space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    marginBottom: Space.md,
  },
  headerCopy: { flex: 1 },
  eyebrow: { ...Type.micro, color: Brand.primary },
  title: { ...Type.h2, fontSize: 17, color: Brand.text, marginTop: 3 },
  orderId: { fontSize: 10.5, color: Brand.textMuted, marginTop: 3, fontWeight: '600', letterSpacing: 0.4 },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.amberSoft,
    paddingHorizontal: Space.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  countdownExpired: { backgroundColor: Brand.redSoft },
  countdownText: { fontSize: 11.5, fontWeight: '800', color: Brand.amber },
  countdownTextExpired: { color: Brand.red },
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: Space.md },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: Space.xxl,
    paddingHorizontal: Space.lg,
  },
  stateTitle: { fontSize: 14, fontWeight: '700', color: Brand.text },
  stateText: { fontSize: 12, color: Brand.textSecondary, textAlign: 'center', lineHeight: 18 },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.ink,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  identityAvatar: {
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 2,
  },
  identityCopy: { flex: 1 },
  identityEyebrow: { ...Type.micro, fontSize: 8.5, color: Brand.inkMuted },
  name: { ...Type.h2, color: Brand.white, marginTop: 2 },
  verifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginTop: 6,
  },
  verifyOk: { backgroundColor: 'rgba(201,241,88,0.12)' },
  verifyPending: { backgroundColor: 'rgba(252,211,77,0.12)' },
  verifyText: { fontSize: 10, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: Space.sm, marginTop: Space.md },
  stat: {
    flex: 1,
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    padding: Space.md,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 10, color: Brand.textSecondary, fontWeight: '600' },
  statValue: { fontSize: 16, fontWeight: '800', color: Brand.text, marginTop: 4 },
  bio: {
    fontSize: 12,
    lineHeight: 18,
    color: Brand.textSecondary,
    marginTop: Space.md,
    paddingHorizontal: 2,
  },
  sectionBlock: { marginTop: Space.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginBottom: Space.sm,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Brand.text },
  sectionCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.md,
  },
  infoRow: { flexDirection: 'row', gap: Space.sm, paddingVertical: 5 },
  infoIcon: { marginTop: 2 },
  infoCopy: { flex: 1 },
  infoLabel: { fontSize: 10.5, color: Brand.textMuted, fontWeight: '600' },
  infoValue: { fontSize: 12, color: Brand.text, lineHeight: 17, marginTop: 1 },
  muted: { fontSize: 11.5, color: Brand.textSecondary, lineHeight: 17 },
  workshopPhoto: {
    width: '100%',
    height: 132,
    borderRadius: Radius.md,
    backgroundColor: Brand.background,
    marginBottom: Space.sm,
  },
  workshopName: { fontSize: 13, fontWeight: '700', color: Brand.text },
  workshopAddress: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2, lineHeight: 17 },
  reviewRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
    paddingVertical: Space.sm,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  reviewName: { flex: 1, fontSize: 12, fontWeight: '700', color: Brand.text },
  stars: { flexDirection: 'row', gap: 1 },
  reviewDate: { fontSize: 9.5, color: Brand.textMuted, marginTop: 2 },
  reviewComment: { fontSize: 11.5, color: Brand.textSecondary, lineHeight: 17, marginTop: 4 },
  expiredBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.redSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.sm,
  },
  expiredText: { flex: 1, fontSize: 11.5, color: Brand.red, lineHeight: 16 },
  actions: { gap: Space.sm, marginTop: Space.sm },
  cancelLink: { alignItems: 'center', paddingVertical: Space.sm },
  cancelText: { fontSize: 12.5, fontWeight: '700', color: Brand.red },
  pressed: { opacity: 0.7 },
});
