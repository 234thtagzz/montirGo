import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { MAX_WORKSHOP_PHOTOS } from '@/features/mechanic/photo';
import type { CertificationDraft } from '@/features/mechanic/profile/use-mechanic-profile';
import type { MechanicReview } from '@/features/mechanic/service';
import { VEHICLE_SPECIALIZATION_OPTIONS } from '@/features/mechanic/specializations';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime, formatIdentityNumber } from '@/utils/format';

interface ProfileFormsSectionProps {
  fullName: string;
  onChangeFullName: (value: string) => void;
  fullNameError: string | null;
  submitAttempted: boolean;
  phone: string;
  onChangePhone: (value: string) => void;
  identityNumber: string | null | undefined;
  bio: string;
  onChangeBio: (value: string) => void;
  experience: string;
  onChangeExperience: (value: string) => void;
  vehicleLabel: string;
  onChangeVehicleLabel: (value: string) => void;
  vehiclePlate: string;
  onChangeVehiclePlate: (value: string) => void;
  workshop: string;
  onChangeWorkshop: (value: string) => void;
  workshopAddress: string;
  onChangeWorkshopAddress: (value: string) => void;
  workshopPhotos: string[];
  workshopPhotoUrls: Record<string, string>;
  uploadingWorkshop: boolean;
  onAddWorkshopPhoto: () => void;
  onRemoveWorkshopPhoto: (path: string) => void;
  skills: string;
  onChangeSkills: (value: string) => void;
  specializations: string[];
  onToggleSpecialization: (value: string) => void;
  certifications: CertificationDraft[];
  onAddCertification: () => void;
  onUpdateCertification: (key: string, patch: Partial<CertificationDraft>) => void;
  onRemoveCertification: (key: string) => void;
  reviews: MechanicReview[];
  saving: boolean;
  onSave: () => void;
  onOpenLogout: () => void;
}

export function ProfileFormsSection(props: ProfileFormsSectionProps) {
  const {
    fullName,
    onChangeFullName,
    fullNameError,
    submitAttempted,
    phone,
    onChangePhone,
    identityNumber,
    bio,
    onChangeBio,
    experience,
    onChangeExperience,
    vehicleLabel,
    onChangeVehicleLabel,
    vehiclePlate,
    onChangeVehiclePlate,
    workshop,
    onChangeWorkshop,
    workshopAddress,
    onChangeWorkshopAddress,
    workshopPhotos,
    workshopPhotoUrls,
    uploadingWorkshop,
    onAddWorkshopPhoto,
    onRemoveWorkshopPhoto,
    skills,
    onChangeSkills,
    specializations,
    onToggleSpecialization,
    certifications,
    onAddCertification,
    onUpdateCertification,
    onRemoveCertification,
    reviews,
    saving,
    onSave,
    onOpenLogout,
  } = props;

  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <Section icon="person-outline" title="Identitas montir">
        <TextField
          label="Nama lengkap"
          required
          value={fullName}
          onChangeText={onChangeFullName}
          error={fullNameError}
          showError={submitAttempted}
        />
        <TextField
          label="Nomor WhatsApp"
          value={phone}
          onChangeText={onChangePhone}
          keyboardType="phone-pad"
          placeholder="08xx xxxx xxxx"
        />
        <ReadOnlyField
          label="Nomor identitas (KTP)"
          value={formatIdentityNumber(identityNumber)}
          helper="Permanen — nomor identitas tidak dapat diubah."
        />
        <TextField
          label="Tentang saya"
          value={bio}
          onChangeText={onChangeBio}
          placeholder="Ceritakan pengalaman dan keahlian utamamu"
          multiline
        />
        <TextField
          label="Pengalaman (tahun)"
          value={experience}
          onChangeText={onChangeExperience}
          keyboardType="number-pad"
          placeholder="5"
        />
      </Section>

      <Section icon="car-outline" title="Kendaraan operasional (opsional)">
        <AppText variant="caption" tone="secondary">
          Membantu client mengenalimu saat tiba di lokasi. Hanya ditampilkan ke client
          setelah pengajuanmu ditugaskan pada order tersebut.
        </AppText>
        <TextField
          label="Kendaraan yang dipakai"
          value={vehicleLabel}
          onChangeText={onChangeVehicleLabel}
          placeholder="Contoh: Honda Vario 160 Hitam"
          maxLength={80}
        />
        <TextField
          label="Nomor polisi"
          value={vehiclePlate}
          onChangeText={onChangeVehiclePlate}
          placeholder="Contoh: B 1234 XYZ"
          autoCapitalize="characters"
          maxLength={20}
        />
      </Section>

      <Section icon="business-outline" title="Data bengkel">
        <TextField
          label="Nama bengkel"
          value={workshop}
          onChangeText={onChangeWorkshop}
          placeholder="Contoh: Bengkel Berkah Jaya"
        />
        <TextField
          label="Alamat bengkel"
          value={workshopAddress}
          onChangeText={onChangeWorkshopAddress}
          placeholder="Jalan, nomor, kelurahan, kota"
          multiline
        />

        <View style={styles.photoLabelRow}>
          <AppText variant="label">Foto bengkel</AppText>
          <AppText variant="caption" tone="muted" tabular>
            {workshopPhotos.length}/{MAX_WORKSHOP_PHOTOS}
          </AppText>
        </View>
        <AppText variant="caption" tone="muted">
          Foto tempat bengkel membantumu lebih mudah dikenali client.
        </AppText>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}
        >
          {workshopPhotos.map((path, index) => (
            <View key={path} style={styles.photoItem}>
              {workshopPhotoUrls[path] ? (
                <Image
                  source={{ uri: workshopPhotoUrls[path] }}
                  style={styles.photoImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={[styles.photoImage, styles.photoLoading]}>
                  <Ionicons
                    name="image-outline"
                    size={22}
                    color={theme.colors.textMuted}
                  />
                </View>
              )}
              {index === 0 ? (
                <View style={styles.coverBadge}>
                  <Badge size="sm" tone="info" label="Sampul" />
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Hapus foto bengkel ${index + 1}`}
                hitSlop={8}
                onPress={() => onRemoveWorkshopPhoto(path)}
                style={styles.photoRemove}
              >
                <Ionicons name="close" size={14} color={theme.colors.textInverse} />
              </Pressable>
            </View>
          ))}

          {workshopPhotos.length < MAX_WORKSHOP_PHOTOS ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tambah foto bengkel"
              disabled={uploadingWorkshop}
              onPress={onAddWorkshopPhoto}
              style={({ pressed }) => [
                styles.photoAdd,
                (pressed || uploadingWorkshop) && styles.pressed,
              ]}
            >
              <Ionicons
                name={uploadingWorkshop ? 'hourglass-outline' : 'camera-outline'}
                size={22}
                color={theme.colors.statusInfoFg}
              />
              <AppText variant="caption" tone="info">
                {uploadingWorkshop ? 'Mengunggah…' : 'Tambah'}
              </AppText>
            </Pressable>
          ) : null}
        </ScrollView>
      </Section>

      <Section icon="construct-outline" title="Keahlian">
        <TextField
          label="Keahlian"
          value={skills}
          onChangeText={onChangeSkills}
          placeholder="tune-up, ganti oli, kelistrikan"
          hint="Pisahkan tiap keahlian dengan koma."
        />

        <AppText variant="label">Spesialisasi kendaraan</AppText>
        <AppText variant="caption" tone="muted">
          Pilih semua yang kamu kuasai — boleh lebih dari satu.
        </AppText>
        <View style={styles.chips}>
          {VEHICLE_SPECIALIZATION_OPTIONS.map((option) => {
            const active = specializations.includes(option.value);
            return (
              <Chip
                key={option.value}
                label={option.label}
                icon={active ? 'checkmark-circle' : option.icon}
                selected={active}
                tone="info"
                onPress={() => onToggleSpecialization(option.value)}
              />
            );
          })}
        </View>
      </Section>

      <Section icon="ribbon-outline" title="Sertifikasi">
        {certifications.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Belum ada sertifikasi. Tambahkan pelatihan atau sertifikat keahlianmu.
          </AppText>
        ) : null}
        {certifications.map((cert, index) => (
          <Surface key={cert.key} variant="subtle" padding="md" style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <AppText variant="label">Sertifikasi {index + 1}</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Hapus sertifikasi ${index + 1}`}
                hitSlop={8}
                onPress={() => onRemoveCertification(cert.key)}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={theme.colors.statusDangerFg}
                />
              </Pressable>
            </View>
            <TextField
              label="Nama sertifikat"
              value={cert.title}
              onChangeText={(value) =>
                onUpdateCertification(cert.key, { title: value })
              }
              placeholder="Teknisi Motor Bersertifikat"
            />
            <View style={styles.twoColumns}>
              <View style={styles.column}>
                <TextField
                  label="Penerbit"
                  value={cert.issuer}
                  onChangeText={(value) =>
                    onUpdateCertification(cert.key, { issuer: value })
                  }
                  placeholder="BLK / lembaga"
                />
              </View>
              <View style={styles.column}>
                <TextField
                  label="Tahun"
                  value={cert.year}
                  onChangeText={(value) =>
                    onUpdateCertification(cert.key, { year: value })
                  }
                  keyboardType="number-pad"
                  placeholder="2024"
                />
              </View>
            </View>
          </Surface>
        ))}
        <Button
          label="Tambah Sertifikasi"
          icon="add-circle-outline"
          variant="secondary"
          size="compact"
          onPress={onAddCertification}
        />
      </Section>

      <Section icon="chatbubbles-outline" title="Ulasan client">
        {reviews.length === 0 ? (
          <AppText variant="caption" tone="muted">
            Belum ada ulasan. Rating muncul setelah client mengulas pesanan lunas.
          </AppText>
        ) : (
          reviews.map((review, index) => (
            <View
              key={review.id}
              style={[styles.reviewRow, index === 0 && styles.reviewRowFirst]}
            >
              <View style={styles.reviewTop}>
                <AppText variant="label" numberOfLines={1} style={styles.reviewName}>
                  {review.reviewer_name ?? 'Client MontirGo'}
                </AppText>
                <View style={styles.stars}>
                  {Array.from({ length: 5 }).map((_, starIdx) => (
                    <Ionicons
                      key={starIdx}
                      name={starIdx < review.rating ? 'star' : 'star-outline'}
                      size={13}
                      color={theme.colors.statusWarningFg}
                    />
                  ))}
                </View>
              </View>
              {review.comment ? (
                <AppText variant="caption" tone="secondary">
                  {review.comment}
                </AppText>
              ) : null}
              <AppText variant="caption" tone="muted">
                {formatDateTime(review.created_at)}
              </AppText>
            </View>
          ))
        )}
      </Section>

      <Button
        label="Simpan Profil"
        icon="save-outline"
        variant="primary"
        size="cta"
        loading={saving}
        onPress={onSave}
      />

      <Button
        label="Keluar"
        icon="log-out-outline"
        variant="dangerSubtle"
        onPress={onOpenLogout}
      />
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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={16} color={theme.colors.statusInfoFg} />
        </View>
        <AppText variant="title">{title}</AppText>
      </View>
      <Surface variant="default" padding="lg" style={styles.sectionCard}>
        {children}
      </Surface>
    </View>
  );
}

function ReadOnlyField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.readOnly}>
        <AppText variant="body" tone={value ? 'primary' : 'muted'} style={styles.readOnlyText}>
          {value || 'Belum diisi'}
        </AppText>
        <Ionicons name="lock-closed" size={16} color={theme.colors.textMuted} />
      </View>
      {helper ? (
        <AppText variant="caption" tone="muted">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    paddingHorizontal: theme.spacing.screenPadding,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  sectionBlock: {
    gap: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sectionCard: {
    gap: theme.spacing.md,
  },
  field: {
    gap: theme.spacing.xs,
  },
  readOnly: {
    minHeight: theme.components.input.minHeight,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  readOnlyText: {
    flex: 1,
  },
  photoLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  photoRow: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  photoItem: {
    position: 'relative' as const,
  },
  photoImage: {
    width: 96,
    height: 76,
    borderRadius: theme.radii.md,
  },
  photoLoading: {
    backgroundColor: theme.colors.bgSurfaceSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  coverBadge: {
    position: 'absolute' as const,
    left: 4,
    bottom: 4,
  },
  photoRemove: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.statusDangerFg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  photoAdd: {
    width: 96,
    height: 76,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: theme.colors.statusInfoBorder,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xxs,
  },
  chips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.xs,
  },
  itemCard: {
    gap: theme.spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  twoColumns: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  column: {
    flex: 1,
  },
  reviewRow: {
    gap: theme.spacing.xxs,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  reviewRowFirst: {
    paddingTop: 0,
    borderTopWidth: 0,
  },
  reviewTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  reviewName: {
    flex: 1,
  },
  stars: {
    flexDirection: 'row' as const,
    gap: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});
