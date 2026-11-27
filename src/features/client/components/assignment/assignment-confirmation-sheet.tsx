import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import {
  getMechanicAssignmentProfile,
  listMechanicReviews,
  respondToAssignment,
  type AssignmentDecision,
  type ClientOrder,
  type ClientReview,
  type MechanicAssignmentProfile,
} from '@/features/client/service';
import { forgetWorkshopPhotoUrl, resolveWorkshopPhotoUrls } from '@/features/mechanic/photo';
import { formatSpecializations } from '@/features/mechanic/specializations';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface AssignmentConfirmationSheetProps {
  visible: boolean;
  order: ClientOrder;
  onResolved: (decision: AssignmentDecision) => Promise<void> | void;
  onRefresh: () => void;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Lembar konfirmasi montir di sisi client (menampilkan kendaraan & plat nomor montir pasca-penugasan).
 */
export function AssignmentConfirmationSheet({
  visible,
  order,
  onResolved,
  onRefresh,
}: AssignmentConfirmationSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<MechanicAssignmentProfile | null>(null);
  const [reviews, setReviews] = useState<ClientReview[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoRetried = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<AssignmentDecision | null>(null);
  const [confirmMode, setConfirmMode] = useState<'reject' | 'reject_and_cancel' | null>(null);
  const [now, setNow] = useState(0);

  const mechanicId = order.mechanic_id;
  const expiresAt = order.assignment_expires_at
    ? new Date(order.assignment_expires_at).getTime()
    : null;

  const load = useCallback(async () => {
    if (!mechanicId) return;
    photoRetried.current = false;
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

  const rawRemainingMs = expiresAt == null || now === 0 ? null : Math.max(0, expiresAt - now);
  const remainingMs =
    rawRemainingMs == null ? null : Math.min(5 * 60 * 1000, rawRemainingMs);
  const expired = remainingMs != null && remainingMs <= 0;

  const specialization = useMemo(
    () => formatSpecializations(profile?.vehicle_specialization),
    [profile?.vehicle_specialization],
  );
  const skills = useMemo(
    () => (profile?.skills ?? []).filter(Boolean).join(' · '),
    [profile?.skills],
  );
  const vehicleInfo = useMemo(
    () =>
      [profile?.vehicle_label?.trim(), profile?.vehicle_plate?.trim()]
        .filter(Boolean)
        .join(' · '),
    [profile?.vehicle_label, profile?.vehicle_plate],
  );

  const runDecision = async (decision: AssignmentDecision) => {
    if (responding || expired) return;
    setConfirmMode(null);
    setResponding(decision);
    try {
      await respondToAssignment(order.id, decision);
      await onResolved(decision);
    } catch (e) {
      showToast({
        tone: 'danger',
        title: 'Gagal menyimpan keputusan',
        message: e instanceof Error ? e.message : 'Coba lagi.',
      });
      onRefresh();
    } finally {
      setResponding(null);
    }
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
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, theme.spacing.lg) }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText variant="overline" tone="info">
                KONFIRMASI MONTIR
              </AppText>
              <AppText variant="h2">Montir ingin menangani pesananmu</AppText>
              <AppText variant="caption" tone="muted" style={theme.tabularNums}>
                #{order.id.slice(0, 8).toUpperCase()}
              </AppText>
            </View>
            {remainingMs != null ? (
              <Badge
                label={expired ? 'Kedaluwarsa' : formatRemaining(remainingMs)}
                tone={expired ? 'danger' : 'warning'}
                icon={expired ? 'alert-circle-outline' : 'time-outline'}
                size="sm"
              />
            ) : null}
          </View>

          {loading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator color={theme.colors.actionPrimaryAltBg} />
              <AppText variant="caption" tone="secondary">
                Memuat profil montir…
              </AppText>
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <Ionicons name="cloud-offline-outline" size={28} color={theme.colors.textMuted} />
              <AppText variant="title">Profil gagal dimuat</AppText>
              <AppText variant="caption" tone="secondary" style={styles.center}>
                {error}
              </AppText>
              <Button label="Coba Lagi" variant="secondary" compact onPress={() => void load()} />
            </View>
          ) : profile ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.identityCard}>
                <Avatar
                  name={profile.full_name ?? 'Montir'}
                  uri={profile.avatar_url}
                  size={52}
                />
                <View style={styles.identityCopy}>
                  <AppText variant="overline" tone="muted">
                    MONTIR YANG MENGAJUKAN DIRI
                  </AppText>
                  <AppText variant="h2" numberOfLines={1}>
                    {profile.full_name?.trim() || 'Montir MontirGo'}
                  </AppText>
                  <Badge
                    label={profile.is_verified ? 'Terverifikasi' : 'Belum verifikasi'}
                    tone={profile.is_verified ? 'success' : 'warning'}
                    icon={profile.is_verified ? 'shield-checkmark' : 'alert-circle-outline'}
                    size="sm"
                  />
                </View>
              </View>

              <View style={styles.statsRow}>
                <Stat
                  value={Number(profile.rating_avg ?? 0).toFixed(1)}
                  label="Rating"
                  icon="star"
                  color={theme.colors.statusWarningFg}
                />
                <Stat
                  value={String(profile.rating_count ?? 0)}
                  label="Ulasan"
                  icon="chatbubble-ellipses-outline"
                  color={theme.colors.statusInfoFg}
                />
                <Stat
                  value={String(profile.total_jobs ?? 0)}
                  label="Job selesai"
                  icon="checkmark-done-outline"
                  color={theme.colors.statusSuccessFg}
                />
              </View>

              {profile.bio?.trim() ? (
                <AppText variant="body" tone="secondary" style={styles.bio}>
                  {profile.bio.trim()}
                </AppText>
              ) : null}

              <Section icon="person-outline" title="Data & kendaraan montir">
                {vehicleInfo ? (
                  <InfoRow
                    icon="car-outline"
                    label="Kendaraan operasional"
                    value={vehicleInfo}
                  />
                ) : null}
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
                {!vehicleInfo &&
                !profile.experience_years &&
                !specialization &&
                !skills &&
                !profile.certifications?.length ? (
                  <AppText variant="caption" tone="secondary">
                    Montir belum melengkapi detail pengalaman dan kendaraannya.
                  </AppText>
                ) : null}
              </Section>

              <Section icon="business-outline" title="Data bengkel">
                {photoUrl ? (
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.workshopPhoto}
                    contentFit="cover"
                    transition={150}
                    onError={() => {
                      const path = profile.workshop_photo;
                      if (!path) return;
                      if (photoRetried.current) {
                        setPhotoUrl(null);
                        return;
                      }
                      photoRetried.current = true;
                      forgetWorkshopPhotoUrl(path);
                      void resolveWorkshopPhotoUrls([path])
                        .then((urls) => setPhotoUrl(urls[path] ?? null))
                        .catch(() => setPhotoUrl(null));
                    }}
                  />
                ) : null}
                <AppText variant="label">
                  {profile.workshop_name?.trim() || 'Montir panggilan'}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {profile.workshop_address?.trim() || 'Belum mengisi alamat bengkel'}
                </AppText>
              </Section>

              <Section icon="chatbubbles-outline" title="Ulasan client">
                {reviews.length === 0 ? (
                  <AppText variant="caption" tone="secondary">
                    Belum ada ulasan. Rating muncul setelah client mengulas pesanan yang lunas.
                  </AppText>
                ) : (
                  reviews.map((review) => <ReviewRow key={review.id} review={review} />)
                )}
              </Section>
            </ScrollView>
          ) : (
            <View style={styles.stateBox}>
              <Ionicons name="person-outline" size={28} color={theme.colors.textMuted} />
              <AppText variant="title">Profil montir tidak tersedia</AppText>
              <AppText variant="caption" tone="secondary" style={styles.center}>
                Montir mungkin sudah tidak terhubung dengan pesanan ini.
              </AppText>
            </View>
          )}

          {expired ? (
            <View style={styles.expiredBox}>
              <Ionicons name="time-outline" size={18} color={theme.colors.statusDangerFg} />
              <AppText variant="caption" tone="danger" style={styles.flexCopy}>
                Waktu konfirmasi habis. Pesanan akan kembali mencari montir.
              </AppText>
              <Button label="Muat Ulang" variant="secondary" compact onPress={onRefresh} />
            </View>
          ) : (
            <View style={styles.actions}>
              <Button
                label="Konfirmasi Montir"
                icon="checkmark-circle-outline"
                size="cta"
                loading={responding === 'accept'}
                disabled={loading || !!error || !profile || responding !== null}
                onPress={() => void runDecision('accept')}
              />
              <Button
                label="Tolak & cari montir lain"
                icon="refresh-outline"
                variant="ghost"
                loading={responding === 'reject'}
                disabled={loading || !!error || responding !== null}
                onPress={() => setConfirmMode('reject')}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tolak dan batalkan pesanan"
                disabled={loading || !!error || responding !== null}
                onPress={() => setConfirmMode('reject_and_cancel')}
                style={({ pressed }) => [styles.cancelLink, pressed && styles.pressed]}
              >
                <AppText variant="label" tone="danger">
                  {responding === 'reject_and_cancel'
                    ? 'Membatalkan pesanan…'
                    : 'Tolak & batalkan pesanan'}
                </AppText>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <ConfirmSheet
        visible={confirmMode === 'reject'}
        destructive
        loading={responding === 'reject'}
        icon="refresh-outline"
        title="Tolak montir ini?"
        message="Pesanan akan dibuka kembali agar montir lain bisa mengajukan diri."
        confirmLabel="Tolak montir"
        cancelLabel="Kembali"
        onConfirm={() => void runDecision('reject')}
        onCancel={() => setConfirmMode(null)}
      />

      <ConfirmSheet
        visible={confirmMode === 'reject_and_cancel'}
        destructive
        loading={responding === 'reject_and_cancel'}
        icon="close-circle-outline"
        title="Tolak & batalkan pesanan?"
        message="Pesanan akan dibatalkan dan tidak bisa dilanjutkan."
        confirmLabel="Batalkan pesanan"
        cancelLabel="Kembali"
        onConfirm={() => void runDecision('reject_and_cancel')}
        onCancel={() => setConfirmMode(null)}
      />
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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <View style={styles.statLabelRow}>
        <Ionicons name={icon} size={13} color={color} />
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
      </View>
      <AppText variant="title" style={theme.tabularNums}>
        {value}
      </AppText>
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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={15} color={theme.colors.statusInfoFg} />
        </View>
        <AppText variant="label">{title}</AppText>
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
  icon: IconName;
  label: string;
  value: string;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color={theme.colors.textMuted} style={styles.infoIcon} />
      <View style={styles.flexCopy}>
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
        <AppText variant="body">{value}</AppText>
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: ClientReview }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewTop}>
        <AppText variant="label" numberOfLines={1} style={styles.flexCopy}>
          {review.reviewer_name ?? 'Client MontirGo'}
        </AppText>
        <View style={styles.stars}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Ionicons
              key={index}
              name={index < review.rating ? 'star' : 'star-outline'}
              size={12}
              color={theme.colors.statusWarningFg}
            />
          ))}
        </View>
      </View>
      <AppText variant="caption" tone="muted">
        {formatDateTime(review.created_at)}
      </AppText>
      {review.comment ? (
        <AppText variant="caption" tone="secondary" numberOfLines={4}>
          {review.comment}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlayScrim,
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    maxHeight: '92%' as const,
    backgroundColor: theme.colors.bgCanvas,
    borderTopLeftRadius: theme.components.sheet.radius,
    borderTopRightRadius: theme.components.sheet.radius,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.screenPadding,
  },
  handle: {
    alignSelf: 'center' as const,
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.components.sheet.handleColor,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  scroll: { flexShrink: 1 },
  scrollContent: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  stateBox: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  center: { textAlign: 'center' as const },
  identityCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.lg,
  },
  identityCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    gap: theme.spacing.xxs,
  },
  statLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  bio: {
    paddingHorizontal: 2,
  },
  sectionBlock: {
    gap: theme.spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sectionCard: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
  },
  infoIcon: { marginTop: 2 },
  flexCopy: { flex: 1 },
  workshopPhoto: {
    width: '100%' as const,
    height: 132,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  reviewRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xxs,
  },
  reviewTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  stars: { flexDirection: 'row' as const, gap: 2 },
  expiredBox: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusDangerBg,
    borderWidth: 1,
    borderColor: theme.colors.statusDangerBorder,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  cancelLink: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: theme.touchTarget.min,
  },
  pressed: { opacity: 0.78 },
});
