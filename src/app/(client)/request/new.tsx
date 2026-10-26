import { useCallback, useMemo, useState } from 'react';
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
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/state';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
import { createServiceRequest, listMyVehicles, type ClientVehicle } from '@/features/client/service';
import { analyzeRequest } from '@/features/service-request/ai';
import {
  SERVICE_CATEGORIES,
  getCategory,
} from '@/features/service-request/categories';

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

  const activeCategory = useMemo(() => getCategory(categoryKey), [categoryKey]);
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
          <Text style={styles.label}>Jenis bantuan</Text>
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
                    size={14}
                    color={active ? Brand.white : category.color}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Kendaraan</Text>
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

          <Text style={styles.label}>Keluhan kendaraan</Text>
          <TextInput
            value={issue}
            onChangeText={setIssue}
            placeholder="Contoh: mesin mati saat di lampu merah, ada suara kasar"
            placeholderTextColor={Brand.textMuted}
            multiline
            style={[styles.input, styles.textarea]}
          />

          <Text style={styles.label}>Gejala tambahan (opsional)</Text>
          <TextInput
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="Contoh: lampu indikator aki menyala"
            placeholderTextColor={Brand.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Lokasi</Text>
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
            <Ionicons
              name={coords ? 'checkmark-circle' : 'location-outline'}
              size={18}
              color={coords ? Brand.green : Brand.primary}
            />
            <Text style={[styles.locationText, coords && styles.locationTextActive]}>
              {locating
                ? 'Mengambil lokasi…'
                : coords
                  ? 'Lokasi terdeteksi'
                  : 'Gunakan lokasi saat ini'}
            </Text>
          </Pressable>

          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder="Alamat / patokan lokasi (opsional)"
            placeholderTextColor={Brand.textMuted}
            style={[styles.input, styles.inputSpaced]}
          />

          <Text style={styles.label}>Nomor WhatsApp</Text>
          <TextInput
            value={contactPhone}
            onChangeText={setPhone}
            placeholder="08xxxxxxxxxx"
            placeholderTextColor={Brand.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Catatan tambahan (opsional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Contoh: kunci ada di bawah kursi"
            placeholderTextColor={Brand.textMuted}
            multiline
            style={[styles.input, styles.textarea]}
          />

          <Text style={styles.disclaimer}>
            Keluhanmu akan dianalisis AI untuk memberi indikasi awal kepada montir. Permintaan
            dikirim ke montir terdekat dan montir akan menghubungimu lewat WhatsApp di nomor
            di atas sebelum berangkat.
          </Text>

          {submitting ? (
            <View style={styles.analyzingRow}>
              <Ionicons name="sparkles" size={14} color={Brand.primary} />
              <Text style={styles.analyzingText}>
                Mengirim permintaan dan menganalisis keluhan dengan AI…
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
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.lg,
    marginBottom: Space.sm,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Space.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
  },
  chipActive: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  chipText: { fontSize: 11.5, fontWeight: '600', color: Brand.textSecondary },
  chipTextActive: { color: Brand.white },
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
    backgroundColor: '#FAFCFF',
  },
  emptyVehicleText: { flex: 1, fontSize: 12, color: Brand.primary },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    minHeight: 48,
    paddingHorizontal: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.primaryBorder,
    backgroundColor: Brand.primarySoft,
  },
  locationButtonActive: { borderColor: Brand.greenSoft, backgroundColor: Brand.greenSoft },
  locationText: { fontSize: 13, fontWeight: '700', color: Brand.primary },
  locationTextActive: { color: Brand.green },
  errorText: { fontSize: 11.5, color: Brand.red, marginTop: Space.sm, lineHeight: 16 },
  disclaimer: {
    fontSize: 11,
    color: Brand.textSecondary,
    lineHeight: 16,
    marginTop: Space.lg,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
