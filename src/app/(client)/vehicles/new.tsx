import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Ionicons } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LoadingState } from '@/components/ui/state';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import {
  createVehicle,
  getMyId,
  getVehicle,
  updateVehicle,
  type VehicleType,
} from '@/features/client/service';
import { VehiclePhoto } from '@/features/vehicles/components/vehicle-photo';
import {
  VEHICLE_TYPE_OPTIONS,
  getVehicleTypeMeta,
} from '@/features/vehicles/constants';
import {
  deleteVehiclePhoto,
  pickVehiclePhoto,
  uploadVehiclePhoto,
  type PickedVehiclePhoto,
} from '@/features/vehicles/photo';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

const TYPES = VEHICLE_TYPE_OPTIONS;

export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const isEdit = Boolean(id);

  const [type, setType] = useState<VehicleType>('motor');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [pickedPhoto, setPickedPhoto] = useState<PickedVehiclePhoto | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const vehicle = await getVehicle(id);
        if (cancelled || !vehicle) return;
        setType(vehicle.type);
        setBrand(vehicle.brand);
        setModel(vehicle.model);
        setYear(vehicle.year ? String(vehicle.year) : '');
        setPlate(vehicle.license_plate);
        setNotes(vehicle.notes ?? '');
        setPhotoPath(vehicle.photo_url);
      } catch (error) {
        showToast({
          tone: 'danger',
          title: 'Gagal memuat kendaraan',
          message: error instanceof Error ? error.message : 'Coba lagi.',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, showToast]);

  const choosePhoto = async () => {
    try {
      const picked = await pickVehiclePhoto();
      if (!picked) return;
      setPickedPhoto(picked);
      setPhotoRemoved(false);
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Gagal memilih foto',
        message: error instanceof Error ? error.message : 'Coba lagi beberapa saat lagi.',
      });
    }
  };

  const removePhoto = () => {
    setPickedPhoto(null);
    setPhotoPath(null);
    setPhotoRemoved(true);
  };

  const brandError = !brand.trim() ? 'Merek wajib diisi.' : null;
  const modelError = !model.trim() ? 'Model wajib diisi.' : null;
  const plateError = !plate.trim() ? 'Nomor polisi wajib diisi.' : null;
  const parsedYear = year.trim() ? Number(year.trim()) : null;
  const yearError =
    parsedYear != null && (Number.isNaN(parsedYear) || parsedYear < 1980 || parsedYear > 2100)
      ? 'Tahun kendaraan harus antara 1980 dan 2100.'
      : null;

  const save = async () => {
    setSubmitted(true);
    if (brandError || modelError || plateError || yearError) {
      showToast({
        tone: 'warning',
        title: 'Periksa data kendaraan',
        message: brandError ?? modelError ?? plateError ?? yearError ?? 'Lengkapi kolom wajib.',
      });
      return;
    }

    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      let photoUrl = photoPath;
      let replacedPhoto: string | null = null;

      if (pickedPhoto) {
        const ownerId = await getMyId();
        uploadedPath = await uploadVehiclePhoto(ownerId, pickedPhoto);
        photoUrl = uploadedPath;
        replacedPhoto = photoPath;
      } else if (photoRemoved) {
        replacedPhoto = photoPath;
        photoUrl = null;
      }

      const payload = {
        type,
        brand: brand.trim(),
        model: model.trim(),
        year: parsedYear,
        license_plate: plate.trim().toUpperCase(),
        notes: notes.trim() || null,
        photo_url: photoUrl,
      };
      if (isEdit && id) await updateVehicle(id, payload);
      else await createVehicle(payload);

      if (replacedPhoto) await deleteVehiclePhoto(replacedPhoto);
      showToast({
        tone: 'success',
        title: isEdit ? 'Perubahan disimpan' : 'Kendaraan ditambahkan',
        message: `${payload.brand} ${payload.model} siap dipakai di form bantuan.`,
      });
      router.back();
    } catch (error) {
      if (uploadedPath) await deleteVehiclePhoto(uploadedPath);
      showToast({
        tone: 'danger',
        title: 'Gagal menyimpan',
        message: error instanceof Error ? error.message : 'Coba lagi beberapa saat lagi.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Kendaraan" />
        <LoadingState message="Memuat data kendaraan..." />
      </View>
    );
  }

  const activeMeta = getVehicleTypeMeta(type);
  const activeTone = theme.tones[activeMeta.tone];

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={isEdit ? 'Ubah Kendaraan' : 'Tambah Kendaraan'}
        subtitle="Data ini mempercepat permintaan bantuan"
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Surface variant="default" padding="md" style={styles.preview}>
            <View style={[styles.previewIcon, { backgroundColor: activeTone.bg }]}>
              <Ionicons name={activeMeta.icon} size={22} color={activeTone.fg} />
            </View>
            <View style={styles.previewCopy}>
              <AppText variant="overline" tone="muted">
                {isEdit ? 'UBAH KENDARAAN' : 'KENDARAAN BARU'}
              </AppText>
              <AppText variant="title" numberOfLines={1}>
                {brand.trim() || model.trim()
                  ? `${brand.trim()} ${model.trim()}`.trim()
                  : 'Belum ada nama'}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {plate.trim() ? plate.trim().toUpperCase() : 'Nomor polisi belum diisi'}
              </AppText>
            </View>
          </Surface>

          <View style={styles.block}>
            <AppText variant="label">Jenis kendaraan</AppText>
            <View style={styles.typeRow}>
              {TYPES.map((item) => {
                const meta = getVehicleTypeMeta(item.key);
                return (
                  <Chip
                    key={item.key}
                    label={item.label}
                    icon={meta.icon}
                    tone={meta.tone}
                    selected={item.key === type}
                    onPress={() => setType(item.key)}
                    style={styles.typeChip}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.block}>
            <AppText variant="label">Foto kendaraan</AppText>
            <View style={styles.photoCard}>
              {pickedPhoto ? (
                <Image
                  source={{ uri: pickedPhoto.uri }}
                  style={styles.photoPreview}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <VehiclePhoto
                  value={photoPath}
                  height={168}
                  emptyLabel="Tambahkan foto kendaraan"
                />
              )}
              <View style={styles.photoActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    pickedPhoto || photoPath ? 'Ganti foto kendaraan' : 'Pilih foto kendaraan'
                  }
                  onPress={() => void choosePhoto()}
                  style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}
                >
                  <Ionicons name="camera-outline" size={17} color={theme.colors.statusInfoFg} />
                  <AppText variant="label" tone="info">
                    {pickedPhoto || photoPath ? 'Ganti Foto' : 'Pilih Foto'}
                  </AppText>
                </Pressable>
                {pickedPhoto || photoPath ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hapus foto kendaraan"
                    onPress={removePhoto}
                    style={({ pressed }) => [
                      styles.photoAction,
                      styles.photoRemove,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="trash-outline" size={17} color={theme.colors.statusDangerFg} />
                    <AppText variant="label" tone="danger">
                      Hapus
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <AppText variant="caption" tone="muted">
              Foto tampak depan/samping membantu montir menyiapkan alat sebelum datang.
            </AppText>
          </View>

          <AppText variant="overline" tone="muted">
            IDENTITAS KENDARAAN
          </AppText>

          <TextField
            label="Merek"
            required
            value={brand}
            onChangeText={setBrand}
            placeholder="Contoh: Honda"
            error={brandError}
            showError={submitted}
          />
          <TextField
            label="Model"
            required
            value={model}
            onChangeText={setModel}
            placeholder="Contoh: Vario 125"
            error={modelError}
            showError={submitted}
          />
          <TextField
            label="Tahun"
            value={year}
            onChangeText={setYear}
            placeholder="Contoh: 2020"
            keyboardType="number-pad"
            error={yearError}
            showError={submitted}
          />
          <TextField
            label="Nomor polisi"
            required
            value={plate}
            onChangeText={setPlate}
            placeholder="Contoh: B 1234 XYZ"
            autoCapitalize="characters"
            error={plateError}
            showError={submitted}
          />
          <TextField
            label="Catatan"
            value={notes}
            onChangeText={setNotes}
            placeholder="Contoh: warna hitam, ada stiker"
          />

          <Button
            label={isEdit ? 'Simpan Perubahan' : 'Simpan Kendaraan'}
            icon="checkmark-circle-outline"
            size="cta"
            loading={saving}
            onPress={() => void save()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  flex: { flex: 1 },
  content: {
    padding: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  preview: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  previewCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  block: {
    gap: theme.spacing.sm,
  },
  typeRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  typeChip: {
    flex: 1,
  },
  photoCard: {
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    backgroundColor: theme.colors.bgSurface,
    overflow: 'hidden' as const,
  },
  photoPreview: {
    width: '100%' as const,
    height: 168,
  },
  photoActions: {
    flexDirection: 'row' as const,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  photoAction: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget.min,
  },
  photoRemove: {
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.borderSubtle,
  },
  pressed: { opacity: 0.78 },
});
