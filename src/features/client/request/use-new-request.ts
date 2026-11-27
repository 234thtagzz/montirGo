import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useToast } from '@/components/ui/toast';
import {
  getPrewarmedClientData,
  setPrewarmedLocation,
  setPrewarmedPricing,
  setPrewarmedVehicles,
} from '@/features/client/prewarm';
import {
  clearRequestDraft,
  loadRequestDraft,
  saveRequestDraft,
} from '@/features/client/request-draft';
import {
  createServiceRequest,
  getCalloutFeeAmountForTier,
  getPlatformPricingAndSupport,
  listMyVehicles,
  updateVehiclePhoto,
  type CalloutFeeTier,
  type ClientVehicle,
  type PlatformPricingAndSupport,
} from '@/features/client/service';
import { analyzeRequest } from '@/features/service-request/ai';
import {
  SERVICE_CATEGORIES,
  getCategory,
} from '@/features/service-request/categories';
import {
  deleteVehiclePhoto,
  pickVehiclePhoto,
  uploadVehiclePhoto,
} from '@/features/vehicles/photo';
import { useSessionUser } from '@/hooks/use-session-user';
import { getCsWhatsAppNumber } from '@/utils/whatsapp';

export const PRESET_CATEGORIES = SERVICE_CATEGORIES.filter((category) => !category.route);

function deriveTierForVehicle(
  categoryKey: string,
  vehicle: ClientVehicle | null,
): CalloutFeeTier {
  if (categoryKey === 'derek') return 'derek';
  if (vehicle?.type === 'mobil') return 'mobil';
  return 'motor';
}

export function useNewRequest(params: { category?: string; vehicleId?: string }) {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSessionUser();
  const userId = user?.id;
  const { showToast } = useToast();

  const prewarm = getPrewarmedClientData();
  const initialCategory = getCategory(params.category) ?? PRESET_CATEGORIES[0];
  const initialTier: CalloutFeeTier =
    initialCategory.defaultTier ??
    deriveTierForVehicle(
      initialCategory.key,
      prewarm.vehicles.find((v) => v.id === params.vehicleId) ??
        (prewarm.vehicles.length === 1 ? prewarm.vehicles[0] : null),
    );

  const [categoryKey, setCategoryKey] = useState(initialCategory.key);
  const [calloutTier, setCalloutTier] = useState<CalloutFeeTier>(initialTier);
  const [tierManuallyChosen, setTierManuallyChosen] = useState(
    initialCategory.key === 'derek',
  );
  const [pricing, setPricing] = useState<PlatformPricingAndSupport>(prewarm.pricing);
  const [vehicles, setVehicles] = useState<ClientVehicle[]>(prewarm.vehicles);
  const [vehicleId, setVehicleId] = useState<string | null>(
    params.vehicleId ??
      (prewarm.vehicles.length === 1 ? prewarm.vehicles[0].id : null),
  );
  const [issue, setIssue] = useState(initialCategory.presetIssue ?? '');
  const [symptoms, setSymptoms] = useState('');
  const [address, setAddress] = useState(prewarm.location?.address ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    prewarm.location
      ? { lat: prewarm.location.lat, lng: prewarm.location.lng }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const draftLoadedRef = useRef(false);
  const userSelectedVehicleRef = useRef(Boolean(params.vehicleId));

  const activeCategory = useMemo(() => getCategory(categoryKey), [categoryKey]);
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null,
    [vehicleId, vehicles],
  );
  const contactPhone = phone ?? user?.phoneNumber ?? '';
  const calloutAmount = useMemo(
    () => getCalloutFeeAmountForTier(pricing, calloutTier),
    [pricing, calloutTier],
  );
  const csWhatsApp = useMemo(
    () => getCsWhatsAppNumber(pricing.cs_whatsapp_number),
    [pricing.cs_whatsapp_number],
  );

  // Validasi inline setiap field wajib.
  const issueError =
    issue.trim().length < 5 ? 'Jelaskan keluhan kendaraan minimal 5 karakter.' : null;
  const phoneError =
    !contactPhone.trim() || contactPhone.replace(/\D/g, '').length < 8
      ? 'Nomor WhatsApp wajib diisi minimal 8 digit agar montir dapat menghubungimu.'
      : null;
  const coordsError = !coords
    ? 'Aktifkan GPS atau pilih titik di peta agar montir mengetahui lokasimu.'
    : null;

  const loadContext = useCallback(async () => {
    const [vehiclesRes, pricingRes] = await Promise.allSettled([
      listMyVehicles(),
      getPlatformPricingAndSupport(),
    ]);

    if (vehiclesRes.status === 'fulfilled') {
      const nextVehicles = vehiclesRes.value;
      setVehicles(nextVehicles);
      setPrewarmedVehicles(nextVehicles);
      if (!userSelectedVehicleRef.current && nextVehicles.length === 1) {
        const only = nextVehicles[0];
        setVehicleId((current) => current ?? only.id);
        if (!tierManuallyChosen) {
          setCalloutTier(deriveTierForVehicle(categoryKey, only));
        }
      }
    }

    if (pricingRes.status === 'fulfilled') {
      setPricing(pricingRes.value);
      setPrewarmedPricing(pricingRes.value);
    }
  }, [categoryKey, tierManuallyChosen]);

  useFocusEffect(
    useCallback(() => {
      void loadContext();
    }, [loadContext]),
  );

  // Pulihkan draf offline (TTL 2 jam, scoped per user) sekali saat user tersedia.
  useEffect(() => {
    const userId = user?.id;
    if (!userId || draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    let active = true;

    void loadRequestDraft(userId).then((draft) => {
      if (!active || !draft) return;
      // Hanya pulihkan draf jika user belum mulai mengedit form saat ini.
      setDraftRestored(true);
      if (draft.issue && (!params.category || draft.categoryKey === categoryKey)) {
        setCategoryKey(draft.categoryKey);
        setCalloutTier(draft.calloutTier);
        setIssue(draft.issue);
      }
      if (draft.symptoms) setSymptoms(draft.symptoms);
      if (draft.address) setAddress((prev) => prev || draft.address);
      if (draft.coords) setCoords((prev) => prev ?? draft.coords);
      if (draft.phone) setPhone(draft.phone);
      if (draft.notes) setNotes(draft.notes);
      if (draft.vehicleId && !params.vehicleId) {
        userSelectedVehicleRef.current = true;
        setVehicleId(draft.vehicleId);
      }
    });

    return () => {
      active = false;
    };
  }, [user?.id, params.category, params.vehicleId, categoryKey]);

  // Simpan draf otomatis dengan debounce 400ms agar aman saat sinyal putus-nyambung.
  useEffect(() => {
    const userId = user?.id;
    if (!userId || submitting) return;
    const timer = setTimeout(() => {
      void saveRequestDraft(userId, {
        categoryKey,
        calloutTier,
        vehicleId,
        issue,
        symptoms,
        address,
        coords,
        phone,
        notes,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    user?.id,
    submitting,
    categoryKey,
    calloutTier,
    vehicleId,
    issue,
    symptoms,
    address,
    coords,
    phone,
    notes,
  ]);

  const selectCategory = useCallback(
    (key: string) => {
      const prevPreset = getCategory(categoryKey)?.presetIssue ?? '';
      const nextCategory = getCategory(key);
      const nextPreset = nextCategory?.presetIssue ?? '';
      setCategoryKey(key);
      setIssue((current) =>
        current.trim() === '' || current === prevPreset ? nextPreset : current,
      );
      if (nextCategory?.defaultTier) {
        setCalloutTier(nextCategory.defaultTier);
        setTierManuallyChosen(true);
      } else if (!tierManuallyChosen) {
        setCalloutTier(deriveTierForVehicle(key, selectedVehicle));
      }
    },
    [categoryKey, selectedVehicle, tierManuallyChosen],
  );

  const selectVehicle = useCallback(
    (nextId: string | null) => {
      userSelectedVehicleRef.current = true;
      setVehicleId(nextId);
      const found = vehicles.find((item) => item.id === nextId) ?? null;
      if (!tierManuallyChosen || categoryKey !== 'derek') {
        setCalloutTier(deriveTierForVehicle(categoryKey, found));
      }
    },
    [vehicles, tierManuallyChosen, categoryKey],
  );

  const selectCalloutTier = useCallback((tier: CalloutFeeTier) => {
    setCalloutTier(tier);
    setTierManuallyChosen(true);
  }, []);

  const attachVehiclePhoto = useCallback(async () => {
    if (!selectedVehicle || !userId || photoBusy) return;
    const vehicle = selectedVehicle;
    try {
      const picked = await pickVehiclePhoto();
      if (!picked) return;

      setPhotoBusy(true);
      const path = await uploadVehiclePhoto(userId, picked);
      try {
        await updateVehiclePhoto(vehicle.id, path);
      } catch (err) {
        await deleteVehiclePhoto(path);
        throw err;
      }

      setVehicles((current) =>
        current.map((item) =>
          item.id === vehicle.id ? { ...item, photo_url: path } : item,
        ),
      );
      if (vehicle.photo_url) await deleteVehiclePhoto(vehicle.photo_url);
      showToast({
        tone: 'success',
        title: 'Foto disimpan',
        message: 'Foto kendaraan siap dilihat oleh montir.',
      });
    } catch (err) {
      showToast({
        tone: 'danger',
        title: 'Gagal menambahkan foto',
        message: err instanceof Error ? err.message : 'Coba lagi beberapa saat lagi.',
      });
    } finally {
      setPhotoBusy(false);
    }
  }, [selectedVehicle, userId, photoBusy, showToast]);

  const reverseGeocodeCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
    if (Platform.OS === 'web') return '';
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (!place) return '';
      return [place.street, place.district, place.city, place.region]
        .filter(Boolean)
        .join(', ');
    } catch {
      return '';
    }
  }, []);

  const detectLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Izin lokasi ditolak. Aktifkan GPS atau hubungi CS lewat tombol di bawah.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      const nextCoords = { lat: latitude, lng: longitude };
      setCoords(nextCoords);
      const resolved = await reverseGeocodeCoords(latitude, longitude);
      setPrewarmedLocation({
        lat: latitude,
        lng: longitude,
        address: resolved,
        updatedAt: Date.now(),
      });
      if (!address.trim() && resolved) {
        setAddress(resolved);
      }
    } catch {
      setLocationError(
        'Sinyal GPS lemah. Isi alamat manual di bawah atau hubungi CS untuk bantuan cepat.',
      );
    } finally {
      setLocating(false);
    }
  }, [address, reverseGeocodeCoords]);

  const applyPinnedLocation = useCallback(
    async (next: { lat: number; lng: number }) => {
      setCoords(next);
      setLocationError(null);
      setPinPickerOpen(false);
      const resolved = await reverseGeocodeCoords(next.lat, next.lng);
      setPrewarmedLocation({
        lat: next.lat,
        lng: next.lng,
        address: resolved || address,
        updatedAt: Date.now(),
      });
      if (resolved) {
        setAddress(resolved);
      }
    },
    [address, reverseGeocodeCoords],
  );

  const submit = useCallback(async () => {
    setSubmitted(true);
    setNetworkError(null);

    if (!userId) {
      showToast({
        tone: 'warning',
        title: 'Sesi berakhir',
        message: 'Silakan masuk kembali untuk mengirim permintaan.',
      });
      router.replace('/(auth)/login');
      return;
    }

    if (issueError || phoneError || coordsError || !coords) {
      showToast({
        tone: 'warning',
        title: 'Lengkapi data wajib',
        message: issueError ?? phoneError ?? coordsError ?? 'Periksa form sebelum mengirim.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { id } = await createServiceRequest({
        clientId: userId,
        vehicleId,
        calloutFeeTier: calloutTier,
        issueDescription: issue,
        symptoms: symptoms || null,
        lat: coords.lat,
        lng: coords.lng,
        address: address || null,
        contactPhone,
        additionalNotes: notes || null,
      });

      await clearRequestDraft(userId);
      void analyzeRequest(id).catch(() => {});
      router.replace({ pathname: '/(client)/orders/[id]', params: { id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim permintaan.';
      setNetworkError(msg);
      showToast({
        tone: 'danger',
        title: 'Gagal mengirim permintaan',
        message: msg,
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    userId,
    issueError,
    phoneError,
    coordsError,
    coords,
    vehicleId,
    calloutTier,
    issue,
    symptoms,
    address,
    contactPhone,
    notes,
    router,
    showToast,
  ]);

  return {
    sessionLoading,
    categoryKey,
    activeCategory,
    calloutTier,
    pricing,
    calloutAmount,
    csWhatsApp,
    vehicles,
    vehicleId,
    selectedVehicle,
    issue,
    setIssue,
    symptoms,
    setSymptoms,
    address,
    setAddress,
    coords,
    locating,
    locationError,
    networkError,
    contactPhone,
    setPhone,
    notes,
    setNotes,
    submitting,
    submitted,
    photoBusy,
    pinPickerOpen,
    setPinPickerOpen,
    draftRestored,
    issueError,
    phoneError,
    coordsError,
    prewarmCoords: prewarm.location
      ? { lat: prewarm.location.lat, lng: prewarm.location.lng }
      : null,
    selectCategory,
    selectVehicle,
    selectCalloutTier,
    attachVehiclePhoto,
    detectLocation,
    applyPinnedLocation,
    submit,
    goAddVehicle: () => router.push('/(client)/vehicles/new'),
  };
}
