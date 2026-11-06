import { useEffect, useState, type ComponentProps } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import {
  createVehicle,
  getMyId,
  getVehicle,
  updateVehicle,
  type VehicleType,
} from '@/features/client/service';
import {
  VEHICLE_TYPE_OPTIONS,
  getVehicleTypeMeta,
} from '@/features/vehicles/constants';
import { VehiclePhoto } from '@/features/vehicles/components/vehicle-photo';
import {
  deleteVehiclePhoto,
  pickVehiclePhoto,
  uploadVehiclePhoto,
  type PickedVehiclePhoto,
} from '@/features/vehicles/photo';

const TYPES = VEHICLE_TYPE_OPTIONS;

export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
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
        Alert.alert('Gagal memuat', error instanceof Error ? error.message : 'Coba lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const choosePhoto = async () => {
    try {
      const picked = await pickVehiclePhoto();
      if (!picked) return;
      setPickedPhoto(picked);
      setPhotoRemoved(false);
    } catch (error) {
      Alert.alert(
        'Gagal memilih foto',
        error instanceof Error ? error.message : 'Coba lagi beberapa saat lagi.',
      );
    }
  };

  const removePhoto = () => {
    setPickedPhoto(null);
    setPhotoPath(null);
    setPhotoRemoved(true);
  };

  const save = async () => {
    if (!brand.trim() || !model.trim() || !plate.trim()) {
      Alert.alert('Validasi', 'Merek, model, dan nomor polisi wajib diisi.');
      return;
    }

    const parsedYear = year.trim() ? Number(year.trim()) : null;
    if (parsedYear != null && (Number.isNaN(parsedYear) || parsedYear < 1980 || parsedYear > 2100)) {
      Alert.alert('Validasi', 'Tahun kendaraan harus antara 1980 dan 2100.');
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

      // Foto lama baru dihapus setelah data tersimpan agar tidak ada momen
      // kendaraan kehilangan foto ketika penyimpanan gagal.
      if (replacedPhoto) await deleteVehiclePhoto(replacedPhoto);
      router.back();
    } catch (error) {
      if (uploadedPath) await deleteVehiclePhoto(uploadedPath);
      Alert.alert(
        'Gagal menyimpan',
        error instanceof Error ? error.message : 'Coba lagi beberapa saat lagi.',
      );
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

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={isEdit ? 'Ubah Kendaraan' : 'Tambah Kendaraan'}
        subtitle="Data ini dipakai untuk mempercepat permintaan bantuan"
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
          <View style={styles.preview}>
            <View style={styles.previewIcon}>
              <Ionicons
                name={getVehicleTypeMeta(type).icon}
                size={22}
                color={Brand.volt}
              />
            </View>
            <View style={styles.previewCopy}>
              <Text style={styles.previewEyebrow}>
                {isEdit ? 'UBAH KENDARAAN' : 'KENDARAAN BARU'}
              </Text>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {brand.trim() || model.trim()
                  ? `${brand.trim()} ${model.trim()}`.trim()
                  : 'Belum ada nama'}
              </Text>
              <Text style={styles.previewPlate}>
                {plate.trim() ? plate.trim().toUpperCase() : 'Nomor polisi belum diisi'}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Jenis kendaraan</Text>
          <View style={styles.typeRow}>
            {TYPES.map((item) => {
              const active = item.key === type;
              const meta = getVehicleTypeMeta(item.key);
              return (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setType(item.key)}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                >
                  <Ionicons
                    name={meta.icon}
                    size={15}
                    color={active ? Brand.volt : meta.color}
                  />
                  <Text style={[styles.typeText, active && styles.typeTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Foto kendaraan</Text>
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
                accessibilityLabel={pickedPhoto || photoPath ? 'Ganti foto kendaraan' : 'Pilih foto kendaraan'}
                onPress={choosePhoto}
                style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}
              >
                <Ionicons name="camera-outline" size={16} color={Brand.primary} />
                <Text style={styles.photoActionText}>
                  {pickedPhoto || photoPath ? 'Ganti Foto' : 'Pilih Foto'}
                </Text>
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
                  <Ionicons name="trash-outline" size={16} color={Brand.red} />
                  <Text style={[styles.photoActionText, styles.photoRemoveText]}>Hapus</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={styles.hint}>
            Foto tampak depan/samping membantu montir menyiapkan alat dan memperkirakan kondisi
            kendaraan sebelum datang.
          </Text>

          <Text style={styles.sectionLabel}>IDENTITAS</Text>
          <Field label="Merek" value={brand} onChangeText={setBrand} placeholder="Contoh: Honda" required />
          <Field label="Model" value={model} onChangeText={setModel} placeholder="Contoh: Vario 125" required />
          <Field
            label="Tahun"
            value={year}
            onChangeText={setYear}
            placeholder="Contoh: 2020"
            keyboardType="number-pad"
          />
          <Field
            label="Nomor polisi"
            value={plate}
            onChangeText={setPlate}
            placeholder="Contoh: B 1234 XYZ"
            autoCapitalize="characters"
            required
          />
          <Field
            label="Catatan"
            value={notes}
            onChangeText={setNotes}
            placeholder="Contoh: warna hitam, ada stiker"
          />

          <Button
            label={isEdit ? 'Simpan Perubahan' : 'Simpan Kendaraan'}
            icon="checkmark-circle-outline"
            loading={saving}
            onPress={save}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  required = false,
  ...inputProps
}: { label: string; required?: boolean } & ComponentProps<typeof TextInput>) {
  return (
    <View>
      <View style={styles.fieldRow}>
        <Text style={styles.label}>{label}</Text>
        {required ? <Text style={styles.required}>WAJIB</Text> : null}
      </View>
      <TextInput
        {...inputProps}
        placeholderTextColor={Brand.textMuted}
        selectionColor={Brand.primary}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.ink,
    borderRadius: Radius.lg,
    padding: Space.md,
  },
  previewIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: { flex: 1 },
  previewEyebrow: { ...Type.micro, fontSize: 9, color: Brand.inkMuted },
  previewTitle: { ...Type.bodyStrong, fontWeight: '700', color: Brand.white, marginTop: 2 },
  previewPlate: { fontSize: 10.5, color: Brand.inkMuted, marginTop: 1, letterSpacing: 0.4 },
  label: {
    ...Type.label,
    fontSize: 12.5,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.lg,
    marginBottom: Space.sm,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  required: {
    ...Type.micro,
    fontSize: 8.5,
    color: Brand.primary,
    backgroundColor: Brand.primarySoft,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sectionLabel: {
    ...Type.micro,
    color: Brand.textMuted,
    marginTop: Space.xxl,
    marginBottom: 2,
  },
  typeRow: { flexDirection: 'row', gap: Space.sm },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  typeChipActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
  typeText: { fontSize: 12.5, fontWeight: '600', color: Brand.textSecondary },
  typeTextActive: { color: Brand.white, fontWeight: '700' },
  photoCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: 168 },
  photoActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.divider,
  },
  photoAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    minHeight: 44,
  },
  photoRemove: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: Brand.divider },
  photoActionText: { fontSize: 12, fontWeight: '700', color: Brand.primary },
  photoRemoveText: { color: Brand.red },
  hint: {
    fontSize: 10.5,
    color: Brand.textMuted,
    lineHeight: 15,
    marginTop: Space.sm,
  },
  pressed: { opacity: 0.7 },
  input: {
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    minHeight: 48,
    fontSize: 13.5,
    color: Brand.text,
  },
  submit: { marginTop: Space.xxl },
});
