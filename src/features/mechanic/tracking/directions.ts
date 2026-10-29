import { decodePolyline } from './polyline';
import { estimateEtaSeconds, haversineMeters, type LatLng } from './geo';

/**
 * Google kini mengarahkan rute ke **Routes API**; Directions API berstatus
 * legacy. Kita coba Routes API lebih dulu, lalu jatuh ke Directions (kalau yang
 * diaktifkan di project justru API lama), dan terakhir garis lurus + estimasi.
 */
const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const DIRECTIONS_ENDPOINT = 'https://maps.googleapis.com/maps/api/directions/json';

/** Batas tunggu satu permintaan rute; lewat dari ini dianggap gagal. */
const REQUEST_TIMEOUT_MS = 8_000;

/** Field mask minimal (dibayar per tier Essentials) — jangan tambah tanpa perlu. */
const ROUTES_FIELD_MASK = [
  'routes.distanceMeters',
  'routes.duration',
  'routes.polyline.encodedPolyline',
].join(',');

export interface TripRoute {
  /** Titik-titik polyline siap digambar di peta. */
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  /** true = garis lurus + estimasi (routing tidak tersedia / gagal). */
  estimated: boolean;
}

interface DirectionsLeg {
  distance?: { value?: number };
  duration?: { value?: number };
  duration_in_traffic?: { value?: number };
}

interface DirectionsResponse {
  status?: string;
  error_message?: string;
  routes?: {
    overview_polyline?: { points?: string };
    legs?: DirectionsLeg[];
  }[];
}

interface RoutesResponse {
  error?: { message?: string };
  routes?: {
    distanceMeters?: number;
    /** Format protobuf duration, mis. "742s". */
    duration?: string;
    polyline?: { encodedPolyline?: string };
  }[];
}

/**
 * Key Maps boleh berada di aplikasi, tetapi wajib dibatasi per API
 * (Maps SDK + Routes/Directions) dan kuotanya di Google Cloud.
 */
export function getMapsApiKey(): string | null {
  const raw = process.env.EXPO_PUBLIC_MAPS_API_KEY?.trim();
  if (!raw || raw === 'isi-maps-api-key-di-sini') return null;
  return raw;
}

/** Rute cadangan saat API tidak bisa dipakai — UI tetap punya arah & ETA. */
export function straightLineRoute(origin: LatLng, destination: LatLng): TripRoute {
  const distance = haversineMeters(origin, destination);
  return {
    coordinates: [origin, destination],
    distanceMeters: distance,
    durationSeconds: estimateEtaSeconds(distance),
    estimated: true,
  };
}

function parseDurationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return match ? Math.round(Number(match[1])) : null;
}

/** Routes API (routingPreferences TRAFFIC_AWARE → durasi sudah termasuk lalu lintas). */
async function fetchRoutesApi(
  origin: LatLng,
  destination: LatLng,
  key: string,
  signal: AbortSignal,
): Promise<TripRoute> {
  const response = await fetch(ROUTES_ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': ROUTES_FIELD_MASK,
    },
    body: JSON.stringify({
      origin: {
        location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } },
      },
      destination: {
        location: {
          latLng: { latitude: destination.latitude, longitude: destination.longitude },
        },
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      polylineQuality: 'OVERVIEW',
      languageCode: 'id',
    }),
  });

  if (!response.ok) throw new Error(`ROUTES_HTTP_${response.status}`);

  const payload = (await response.json()) as RoutesResponse;
  if (payload.error) throw new Error(`ROUTES_${payload.error.message ?? 'ERROR'}`);

  const route = payload.routes?.[0];
  const coordinates = decodePolyline(route?.polyline?.encodedPolyline ?? '');
  if (coordinates.length < 2) throw new Error('ROUTES_EMPTY');

  const distance = route?.distanceMeters ?? haversineMeters(origin, destination);
  return {
    coordinates,
    distanceMeters: distance,
    durationSeconds:
      parseDurationSeconds(route?.duration) ?? estimateEtaSeconds(distance),
    estimated: false,
  };
}

/** Directions API lama — dipakai hanya bila Routes API tidak tersedia. */
async function fetchDirectionsApi(
  origin: LatLng,
  destination: LatLng,
  key: string,
  signal: AbortSignal,
): Promise<TripRoute> {
  const url =
    `${DIRECTIONS_ENDPOINT}?origin=${origin.latitude},${origin.longitude}` +
    `&destination=${destination.latitude},${destination.longitude}` +
    `&mode=driving&departure_time=now&language=id&key=${encodeURIComponent(key)}`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`DIRECTIONS_HTTP_${response.status}`);

  const payload = (await response.json()) as DirectionsResponse;
  if (payload.status !== 'OK') {
    throw new Error(payload.error_message ?? payload.status ?? 'ROUTE_NOT_FOUND');
  }

  const route = payload.routes?.[0];
  const leg = route?.legs?.[0];
  const coordinates = decodePolyline(route?.overview_polyline?.points ?? '');
  if (coordinates.length < 2) throw new Error('ROUTE_EMPTY');

  const distance = leg?.distance?.value ?? haversineMeters(origin, destination);
  return {
    coordinates,
    distanceMeters: distance,
    durationSeconds:
      leg?.duration_in_traffic?.value ??
      leg?.duration?.value ??
      estimateEtaSeconds(distance),
    estimated: false,
  };
}

/** Sekali Routes API ditolak (key dibatasi / API belum aktif), jangan dicoba lagi. */
let routesApiDisabled = false;

export async function fetchTripRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<TripRoute> {
  // Sudah di depan lokasi: tidak perlu memanggil API rute.
  if (haversineMeters(origin, destination) < 25) {
    return {
      coordinates: [origin, destination],
      distanceMeters: 0,
      durationSeconds: 0,
      estimated: false,
    };
  }

  const key = getMapsApiKey();
  if (!key) return straightLineRoute(origin, destination);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    if (!routesApiDisabled) {
      try {
        return await fetchRoutesApi(origin, destination, key, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) throw error;
        routesApiDisabled = true;
      }
    }
    return await fetchDirectionsApi(origin, destination, key, controller.signal);
  } catch {
    // Timeout, offline, key dibatasi, atau kuota habis: pakai estimasi.
    return straightLineRoute(origin, destination);
  } finally {
    clearTimeout(timeout);
  }
}
