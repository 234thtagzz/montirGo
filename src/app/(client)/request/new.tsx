import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
import {
  createServiceRequest,
  listMyVehicles,
  updateVehiclePhoto,
  type ClientVehicle,
} from '@/features/client/service';
import { analyzeRequest } from '@/features/service-request/ai';
import {
  SERVICE_CATEGORIES,
  getCategory,
} from '@/features/service-request/categories';
import { VehicleProfileCard } from '@/features/vehicles/components/vehicle-profile-card';
import {
  deleteVehiclePhoto,
  pickVehiclePhoto,
  uploadVehiclePhoto,
} from '@/features/vehicles/photo';

const PRESET_CATEGORIES = SERVICE_CATEGORIES.filter((category) => !category.route);

export default function NewServiceRequestScreen() {
  const params = useLocalSearchParams<{ category?: string; vehicleId?: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSessionUser();

  const initialCategory = getCategory(params.category) ?? PRESET_CATEGORIES[0];

  const [categoryKey, setCategoryKey] = useState(initialCategory.key);
  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(params.vehicleId ?? null);
  const [issue, setIssue] = useState(initialCategory.presetIssue ?? '');
  const [symptoms, setSymptoms] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const activeCategory = useMemo(() => getCategory(categoryKey), [categoryKey]);
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
    [vehicleId, vehicles],
  );
  const contactPhone = phone ?? user?.phoneNumber ?? '';

  const loadVehicles = useCallback(async () => {
    try {
      setVehicles(await listMyVehicles());
    } catch {
      // Kendaraan opsional — form tetap bisa dikirim tanpa kendaraan tersimpan.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [loadVehicles]),
  );

  const selectCategory = (key: string) => {
    const previousPreset = getCategory(categoryKey)?.presetIssue ?? '';
    const nextPreset = getCategory(key)?.presetIssue ?? '';
    setCategoryKey(key);
    setIssue((current) => (current.trim() === '' || current === previousPreset ? nextPreset : current));
  };

  /**
   * Tambah/ganti foto kendaraan langsung dari form request supaya client tidak
   * perlu membuka garasi dulu. Foto diunggah ke bucket privat lalu path-nya
   * disimpan di kendaraan, sehingga montir bisa melihatnya di detail request.
   */
  const attachVehiclePhoto = async () => {
    if (!selectedVehicle || !user?.id || photoBusy) return;
    const vehicle = selectedVehicle;
    try {
      const picked = await pickVehiclePhoto();
      if (!picked) return;

      setPhotoBusy(true);
      const path = await uploadVehiclePhoto(user.id, picked);
      try {
        await updateVehiclePhoto(vehicle.id, path);
      } catch (error) {
        await deleteVehiclePhoto(path);
        throw error;
      }

      setVehicles((current) =>
        current.map((item) =>
          item.id === vehicle.id ? { ...item, photo_url: path } : item,
        ),
      );
      if (vehicle.photo_url) await deleteVehiclePhoto(vehicle.photo_url);
    } catch (error) {
      Alert.alert(
        'Gagal menambahkan foto',
        error instanceof Error ? error.message : 'Coba lagi beberapa saat lagi.',
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const detectLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Izin lokasi ditolak. Aktifkan izin lokasi untuk mengirim permintaan.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      setCoords({ lat: latitude, lng: longitude });

      let resolvedAddress = '';
      if (Platform.OS !== 'web') {
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (place) {
            resolvedAddress = [
              place.street,
              place.district,
              place.city,
              place.region,
            ]
              .filter(Boolean)
              .join(', ');
          }
        } catch {
          // Reverse geocode gagal: koordinat tetap tersimpan, alamat bisa diisi manual.
        }
      }

      if (!address.trim()) {
        setAddress(resolvedAddress || 'Lokasi terdeteksi');
      }
    } catch {
      setLocationError('Gagal mengambil lokasi. Coba lagi atau isi alamat manual.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!user?.id) {
      Alert.alert('Sesi berakhir', 'Silakan login kembali.');
      router.replace('/(auth)/login');
      return;
    }
    if (issue.trim().length < 5) {
      Alert.alert('Validasi', 'Jelaskan keluhan kendaraan minimal 5 karakter.');
      return;
    }
    if (!contactPhone.trim() || contactPhone.replace(/\D/g, '').length < 8) {
      Alert.alert(
        'Validasi',
        'Nomor WhatsApp wajib diisi agar montir bisa menghubungimu terkait pesanan.',
      );
      return;
    }
    if (!coords) {
      Alert.alert(
        'Lokasi belum aktif',
        'Tekan "Gunakan lokasi saat ini" supaya montir tahu titik lokasimu.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const { id } = await createServiceRequest({
        clientId: user.id,
        vehicleId,
        issueDescription: issue,
        symptoms: symptoms || null,
        lat: coords.lat,
        lng: coords.lng,
        address: address || null,
        contactPhone,
        additionalNotes: notes || null,
      });

      // Analisis AI dijalankan setelah request tersimpan. Kegagalan AI tidak
      // boleh menggagalkan permintaan — client bisa analisis ulang di detail.
      let analysisFailed = false;
      let analysisMessage = '';
      try {
        await analyzeRequest(id);
      } catch (analysisError) {
        analysisFailed = true;
        analysisMessage =
          analysisError instanceof Error
            ? analysisError.message
            : 'Analisis AI belum tersedia.';
      }

      if (analysisFailed) {
        Alert.alert(
          'Permintaan terkirim',
          `${analysisMessage}\n\nKamu tetap bisa mencoba analisis ulang dari detail pesanan.`,
          [
            {
              text: 'Lihat Pesanan',
              onPress: () =>
                router.replace({ pathname: '/(client)/orders/[id]', params: { id } }),
            },
          ],
          { cancelable: false },
        );
      } else {
        router.replace({ pathname: '/(client)/orders/[id]', params: { id } });
      }
    } catch (error) {
      Alert.alert(
        'Gagal mengirim',
        error instanceof Error ? error.message : 'Coba lagi beberapa saat lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionLoading) {
    return <LoadingState message="Menyiapkan form..." />;
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Butuh Montir" subtitle={activeCategory?.description} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summary}>
            <View style={styles.summaryIcon}>
              <Ionicons
                name={activeCategory?.icon ?? 'construct-outline'}
                size={20}
                color={Brand.volt}
              />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryEyebrow}>LAYANAN DIPILIH</Text>
              <Text style={styles.summaryTitle}>{activeCategory?.label ?? 'Butuh Montir'}</Text>
            </View>
            <Text style={styles.summaryStep}>1 / 1</Text>
          </View>

          <FieldLabel title="Jenis bantuan" hint="Pilih yang paling sesuai dengan masalahmu." />
          <View style={styles.chipsWrap}>
            {PRESET_CATEGORIES.map((category) => {
              const active = category.key === categoryKey;
              return (
                <Pressable
                  key={category.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => selectCategory(category.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Ionicons
                    name={category.icon}
                    size={13}
                    color={active ? Brand.volt : category.color}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FieldLabel
            title="Kendaraan"
            hint="Opsional — membantu montir menyiapkan alat yang tepat."
          />
          {vehicles.length === 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(client)/vehicles/new')}
              style={({ pressed }) => [styles.emptyVehicle, pressed && styles.pressed]}
            >
              <Ionicons name="add-circle-outline" size={18} color={Brand.primary} />
              <Text style={styles.emptyVehicleText}>
                Belum ada kendaraan tersimpan. Tambah kendaraan (opsional).
              </Text>
            </Pressable>
          ) : (
            <View style={styles.chipsWrap}>
              <VehicleChip
                label="Tanpa kendaraan"
                active={vehicleId === null}
                onPress={() => setVehicleId(null)}
              />
              {vehicles.map((vehicle) => (
                <VehicleChip
                  key={vehicle.id}
                  label={`${vehicle.brand} ${vehicle.model} • ${vehicle.license_plate}`}
                  active={vehicleId === vehicle.id}
                  onPress={() => setVehicleId(vehicle.id)}
                />
              ))}
            </View>
          )}

          {selectedVehicle ? (
            <View style={styles.vehiclePreview}>
              <VehicleProfileCard
                variant="compact"
                photo={selectedVehicle.photo_url}
                type={selectedVehicle.type}
                brand={selectedVehicle.brand}
                model={selectedVehicle.model}
                year={selectedVehicle.year}
                plate={selectedVehicle.license_plate}
                notes={selectedVehicle.notes}
                footer={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      selectedVehicle.photo_url
                        ? 'Ganti foto kendaraan'
                        : 'Tambah foto kendaraan'
                    }
                    disabled={photoBusy}
                    onPress={attachVehiclePhoto}
                    style={({ pressed }) => [
                      styles.photoButton,
                      pressed && styles.pressed,
                      photoBusy && styles.photoButtonDisabled,
                    ]}
                  >
                    {photoBusy ? (
                      <ActivityIndicator size="small" color={Brand.primary} />
                    ) : (
                      <Ionicons name="camera-outline" size={14} color={Brand.primary} />
                    )}
                    <Text style={styles.photoButtonText}>
                      {photoBusy
                        ? 'Mengunggah foto...'
                        : selectedVehicle.photo_url
                          ? 'Ganti foto kendaraan'
                          : 'Tambah foto kendaraan'}
                    </Text>
                  </Pressable>
                }
              />
              <Text style={styles.vehicleHint}>
                Foto dan jenis kendaraan otomatis dikirim ke montir agar analisisnya lebih akurat.
              </Text>
            </View>
          ) : null}

          <FieldLabel
            title="Keluhan kendaraan"
            hint="Tulis sedetail mungkin agar montir datang dengan persiapan tepat."
            required
          />
          <TextInput
            value={issue}
            onChangeText={setIssue}
            placeholder="Contoh: mesin mati saat di lampu merah, ada suara kasar"
            placeholderTextColor={Brand.textMuted}
            selectionColor={Brand.primary}
            multiline
            style={[styles.input, styles.textarea]}
          />

          <FieldLabel title="Gejala tambahan" hint="Opsional." />
          <TextInput
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="Contoh: lampu indikator aki menyala"
            placeholderTextColor={Brand.textMuted}
            selectionColor={Brand.primary}
            style={styles.input}
          />

          <FieldLabel title="Lokasi" hint="Montir berangkat ke titik ini." required />
          <Pressable
            accessibilityRole="button"
            onPress={detectLocation}
            disabled={locating}
            style={({ pressed }) => [
              styles.locationButton,
              coords && styles.locationButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.locationIcon, coords && styles.locationIconActive]}>
              <Ionicons
                name={coords ? 'checkmark' : 'location-outline'}
                size={16}
                color={coords ? Brand.green : Brand.primary}
              />
            </View>
            <View style={styles.locationCopy}>
              <Text style={[styles.locationText, coords && styles.locationTextActive]}>
                {locating
                  ? 'Mengambil lokasi…'
                  : coords
                    ? 'Lokasi terdeteksi'
                    : 'Gunakan lokasi saat ini'}
              </Text>
              <Text style={styles.locationHint}>
                {coords
                  ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : 'Kami memakai GPS perangkatmu'}
              </Text>
            </View>
            {locating ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
          </Pressable>

          {locationError ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={Brand.red} />
              <Text style={styles.errorText}>{locationError}</Text>
            </View>
          ) : null}

          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Alamat / patokan lokasi (opsional)"
            placeholderTextColor={Brand.textMuted}
            selectionColor={Brand.primary}
            style={[styles.input, styles.inputSpaced]}
          />

          <FieldLabel title="Nomor WhatsApp" hint="Montir menghubungi nomor ini sebelum berangkat." required />
          <TextInput
            value={contactPhone}
            onChangeText={setPhone}
            placeholder="08xxxxxxxxxx"
            placeholderTextColor={Brand.textMuted}
            selectionColor={Brand.primary}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <FieldLabel title="Catatan tambahan" hint="Opsional — mis. kunci ada di bawah kursi." />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Contoh: kunci ada di bawah kursi"
            placeholderTextColor={Brand.textMuted}
            selectionColor={Brand.primary}
            multiline
            style={[styles.input, styles.textarea]}
          />

          <View style={styles.disclaimer}>
            <Ionicons name="sparkles-outline" size={14} color={Brand.primary} />
            <Text style={styles.disclaimerText}>
              Keluhanmu dianalisis AI sebagai indikasi awal untuk montir. Permintaan dikirim ke
              montir terdekat yang akan menghubungimu lewat WhatsApp.
            </Text>
          </View>

          {submitting ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator size="small" color={Brand.primary} />
              <Text style={styles.analyzingText}>
                Mengirim permintaan dan menganalisis keluhan…
              </Text>
            </View>
          ) : null}

          <Button
            label="Kirim Permintaan"
            icon="paper-plane-outline"
            loading={submitting}
            onPress={submit}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldLabel({
  title,
  hint,
  required = false,
}: {
  title: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <View style={styles.fieldLabel}>
      <View style={styles.fieldTitleRow}>
        <Text style={styles.label}>{title}</Text>
        {required ? <Text style={styles.required}>WAJIB</Text> : null}
      </View>
      {hint ? <Text style={styles.labelHint}>{hint}</Text> : null}
    </View>
  );
}

function VehicleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  flex: { flex: 1 },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: Brand.ink,
    borderRadius: Radius.lg,
    padding: Space.md,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: { flex: 1 },
  summaryEyebrow: { ...Type.micro, fontSize: 9, color: Brand.inkMuted },
  summaryTitle: { ...Type.bodyStrong, fontWeight: '700', color: Brand.white, marginTop: 2 },
  summaryStep: { fontSize: 10.5, color: Brand.inkMuted, fontWeight: '700' },
  fieldLabel: { marginTop: Space.lg, marginBottom: Space.sm },
  fieldTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { ...Type.label, fontSize: 12.5, fontWeight: '700', color: Brand.text },
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
  labelHint: { fontSize: 10.5, color: Brand.textMuted, marginTop: 2, lineHeight: 15 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Space.md,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  chipActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
  chipText: { fontSize: 11.5, fontWeight: '600', color: Brand.textSecondary },
  chipTextActive: { color: Brand.white, fontWeight: '700' },
  input: {
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    fontSize: 13.5,
    color: Brand.text,
    minHeight: 48,
  },
  inputSpaced: { marginTop: Space.sm },
  textarea: { minHeight: 92, textAlignVertical: 'top' },
  emptyVehicle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Brand.primaryBorder,
    backgroundColor: Brand.surface,
  },
  emptyVehicleText: { flex: 1, fontSize: 12, color: Brand.primary },
  vehiclePreview: { marginTop: Space.sm },
  vehicleHint: {
    fontSize: 10.5,
    color: Brand.textMuted,
    lineHeight: 15,
    marginTop: Space.xs,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: Space.sm,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primarySoft,
  },
  photoButtonDisabled: { opacity: 0.65 },
  photoButtonText: { fontSize: 10.5, fontWeight: '700', color: Brand.primary },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    minHeight: 58,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.primaryBorder,
    backgroundColor: Brand.primarySoft,
  },
  locationButtonActive: { borderColor: Brand.greenSoft, backgroundColor: Brand.greenSoft },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.xs,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconActive: { backgroundColor: Brand.surface },
  locationCopy: { flex: 1 },
  locationText: { fontSize: 12.5, fontWeight: '700', color: Brand.primary },
  locationTextActive: { color: Brand.green },
  locationHint: { fontSize: 10, color: Brand.textMuted, marginTop: 1 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: Space.sm,
  },
  errorText: { flex: 1, fontSize: 11, color: Brand.red, lineHeight: 15 },
  disclaimer: {
    flexDirection: 'row',
    gap: Space.sm,
    backgroundColor: Brand.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Space.md,
    marginTop: Space.xl,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: Brand.textSecondary,
    lineHeight: 16,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    marginTop: Space.lg,
  },
  analyzingText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: Brand.primary },
  submit: { marginTop: Space.lg },
  pressed: { opacity: 0.75 },
});
