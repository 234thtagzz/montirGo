import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLastMechanicLocation, recordMechanicLocation } from '../service';
import { fetchTripRoute, getMapsApiKey, type TripRoute } from './directions';
import { estimateEtaSeconds, haversineMeters, type LatLng } from './geo';

/** Kirim posisi paling cepat tiap 5 detik … */
const PUBLISH_INTERVAL_MS = 5_000;
/** … dan hanya bila montir benar-benar bergeser minimal 15 meter. */
const PUBLISH_MIN_DISTANCE_M = 15;
/** Fix GPS dengan akurasi lebih buruk dari ini dibuang (mis. di dalam gedung). */
const MAX_ACCURACY_METERS = 80;
/** Rute dihitung ulang bila sudah 20 detik atau bergeser 200 meter. */
const ROUTE_REFRESH_MS = 20_000;
const ROUTE_REFRESH_DISTANCE_M = 200;
/** Jeda sebelum mencoba lagi setelah permintaan rute gagal. */
const ROUTE_RETRY_MS = 15_000;
/** Radius "sudah dekat lokasi" untuk menonjolkan tombol tiba. */
export const ARRIVAL_RADIUS_METERS = 60;

export type TripPermission = 'unknown' | 'granted' | 'denied';

export interface TripTracking {
  permission: TripPermission;
  position: LatLng | null;
  heading: number | null;
  route: TripRoute | null;
  routeLoading: boolean;
  locationError: string | null;
  /** Jarak garis lurus ke titik client (selalu ter-update, tidak menunggu API). */
  distanceToDestinationM: number | null;
  /** Sisa jarak tempuh menurut rute (turun halus di antara refresh). */
  remainingDistanceM: number | null;
  etaSeconds: number | null;
  isNearDestination: boolean;
  usingEstimatedRoute: boolean;
  retryPermission: () => void;
}

interface UseTripTrackingOptions {
  requestId?: string;
  destination: LatLng | null;
  status?: string | null;
  /** false saat layar tidak fokus — semua watcher dihentikan. */
  active?: boolean;
}

/**
 * Orkestrator perjalanan montir: izin lokasi, watcher GPS, publikasi posisi ke
 * Supabase, dan perhitungan rute/ETA. Semua efek berat dimatikan saat layar
 * tidak fokus agar baterai tidak terkuras.
 */
export function useTripTracking({
  requestId,
  destination,
  status,
  active = true,
}: UseTripTrackingOptions): TripTracking {
  const [permission, setPermission] = useState<TripPermission>('unknown');
  const [position, setPosition] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [route, setRoute] = useState<TripRoute | null>(null);
  const [routeScale, setRouteScale] = useState(1);
  const [routeLoading, setRouteLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const isEnroute = status === 'on_the_way';
  const positionRef = useRef<LatLng | null>(null);
  const destinationRef = useRef<LatLng | null>(destination);
  const requestIdRef = useRef<string | undefined>(requestId);
  const enrouteRef = useRef(isEnroute);
  const lastPublishRef = useRef<{ at: number; coords: LatLng | null }>({
    at: 0,
    coords: null,
  });
  const routeMetaRef = useRef<{ origin: LatLng | null; at: number }>({
    origin: null,
    at: 0,
  });
  const routeRequestRef = useRef(0);
  const routeRetryAtRef = useRef(0);
  const hasRouteRef = useRef(false);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    requestIdRef.current = requestId;
  }, [requestId]);

  useEffect(() => {
    enrouteRef.current = isEnroute;
    // Perjalanan baru dimulai: titik pertama langsung dikirim.
    if (isEnroute) lastPublishRef.current = { at: 0, coords: null };
  }, [isEnroute]);

  const applyPosition = useCallback((coords: Location.LocationObjectCoords) => {
    if (coords.accuracy != null && coords.accuracy > MAX_ACCURACY_METERS) return;

    const next: LatLng = { latitude: coords.latitude, longitude: coords.longitude };
    positionRef.current = next;
    setPosition(next);
    setLocationError(null);

    if (coords.heading != null && Number.isFinite(coords.heading) && coords.heading >= 0) {
      setHeading(coords.heading);
    }

    const activeRequestId = requestIdRef.current;
    if (!enrouteRef.current || !activeRequestId) return;

    const now = Date.now();
    const last = lastPublishRef.current;
    const moved =
      !last.coords || haversineMeters(last.coords, next) >= PUBLISH_MIN_DISTANCE_M;
    if (now - last.at < PUBLISH_INTERVAL_MS || !moved) return;

    lastPublishRef.current = { at: now, coords: next };
    void recordMechanicLocation(activeRequestId, {
      lat: next.latitude,
      lng: next.longitude,
      accuracy: coords.accuracy ?? null,
    }).catch(() => {
      // Offline / validasi sementara: percobaan berikutnya mengirim posisi baru.
    });
  }, []);

  const [permissionAttempt, setPermissionAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    Location.requestForegroundPermissionsAsync()
      .then(async (result) => {
        if (cancelled) return;
        if (!result.granted) {
          setPermission('denied');
          setLocationError(
            'Izin lokasi ditolak. Aktifkan izin lokasi agar montir bisa dinavigasi ke client.',
          );
          return;
        }
        setPermission('granted');

        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
        if (cancelled) return;
        if (lastKnown) applyPosition(lastKnown.coords);

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) applyPosition(current.coords);
      })
      .catch(() => {
        if (!cancelled) {
          setLocationError('Gagal membaca lokasi. Pastikan GPS aktif lalu coba lagi.');
        }
      });

    return () => {
      cancelled = true;
    };
    // `permissionAttempt` memicu ulang alur saat tombol "Aktifkan" ditekan.
  }, [active, permissionAttempt, applyPosition]);

  // Resume: tampilkan titik terakhir yang sudah terkirim sebelum GPS hidup.
  useEffect(() => {
    if (!active || !requestId || position) return;
    let cancelled = false;
    getLastMechanicLocation(requestId)
      .then((point) => {
        if (cancelled || !point || positionRef.current) return;
        const restored = { latitude: point.lat, longitude: point.lng };
        positionRef.current = restored;
        setPosition(restored);
      })
      .catch(() => {
        // Riwayat opsional — GPS langsung tetap menjadi sumber utama.
      });
    return () => {
      cancelled = true;
    };
  }, [active, requestId, position]);

  // Watcher GPS: hanya saat izin diberikan dan layar aktif.
  useEffect(() => {
    if (!active || permission !== 'granted') return;

    let disposed = false;
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 4_000,
        distanceInterval: 10,
      },
      (update) => applyPosition(update.coords),
    )
      .then((sub) => {
        if (disposed) {
          sub.remove();
          return;
        }
        subscription = sub;
      })
      .catch(() => {
        setLocationError('GPS tidak aktif. Nyalakan lokasi pada perangkat.');
      });

    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, [active, permission, applyPosition]);

  const positionKey = position
    ? `${position.latitude.toFixed(5)},${position.longitude.toFixed(5)}`
    : null;
  const destinationKey = destination
    ? `${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`
    : null;

  // Hitung / segarkan rute ke titik client.
  // Permintaan sengaja tidak dibatalkan saat posisi berubah: hasil yang sudah
  // tidak relevan diabaikan lewat nomor urut. Dengan begitu GPS yang sering
  // update tidak memotong permintaan Directions di jaringan lambat.
  useEffect(() => {
    const origin = positionRef.current;
    const target = destinationRef.current;
    if (!origin || !target) return;
    if (Date.now() < routeRetryAtRef.current) return;

    const last = routeMetaRef.current;
    const moved =
      !last.origin || haversineMeters(last.origin, origin) >= ROUTE_REFRESH_DISTANCE_M;
    const stale = Date.now() - last.at >= ROUTE_REFRESH_MS;
    if (last.origin && !moved && !stale) return;

    routeMetaRef.current = { origin, at: Date.now() };
    const requestId = ++routeRequestRef.current;
    if (!hasRouteRef.current) setRouteLoading(true);

    fetchTripRoute(origin, target)
      .then((next) => {
        if (requestId !== routeRequestRef.current) return;
        const straight = Math.max(1, haversineMeters(origin, target));
        hasRouteRef.current = true;
        setRouteScale(Math.max(1, next.distanceMeters / straight));
        setRoute(next);
      })
      .catch(() => {
        if (requestId !== routeRequestRef.current) return;
        // Gagal: coba lagi setelah jeda, bukan setiap update GPS.
        routeMetaRef.current = { origin: null, at: 0 };
        routeRetryAtRef.current = Date.now() + ROUTE_RETRY_MS;
      })
      .finally(() => {
        if (requestId === routeRequestRef.current) setRouteLoading(false);
      });
  }, [positionKey, destinationKey]);

  const distanceToDestinationM =
    position && destination ? haversineMeters(position, destination) : null;

  const remainingDistanceM =
    route && distanceToDestinationM != null
      ? Math.min(route.distanceMeters, Math.round(distanceToDestinationM * routeScale))
      : (route?.distanceMeters ?? distanceToDestinationM);

  const etaSeconds =
    route && route.distanceMeters > 0 && remainingDistanceM != null
      ? Math.round((remainingDistanceM / route.distanceMeters) * route.durationSeconds)
      : distanceToDestinationM != null
        ? estimateEtaSeconds(distanceToDestinationM)
        : null;

  return {
    permission,
    position,
    heading,
    route,
    routeLoading,
    locationError,
    distanceToDestinationM,
    remainingDistanceM,
    etaSeconds,
    isNearDestination:
      distanceToDestinationM != null && distanceToDestinationM <= ARRIVAL_RADIUS_METERS,
    usingEstimatedRoute: route?.estimated ?? getMapsApiKey() == null,
    retryPermission: () => {
      setPermission('unknown');
      setPermissionAttempt((value) => value + 1);
    },
  };
}
