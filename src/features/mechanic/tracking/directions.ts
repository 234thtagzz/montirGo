import { decodePolyline } from './polyline';
import { estimateEtaSeconds, haversineMeters, type LatLng } from './geo';

/**
 * Sumber rute perjalanan montir.
 *
 * Urutan percobaan:
 *   1. Google **Routes API** (paling akurat, sadar lalu lintas).
 *   2. Google **Directions API** (legacy — untuk project yang hanya
 *      mengaktifkan API lama).
 *   3. **OSRM** publik (OpenStreetMap) — rute jalan nyata tanpa API key,
 *      dipakai saat Google belum diaktifkan / key dibatasi.
 *   4. Garis lurus + estimasi (offline total).
 *
 * Catatan produksi: endpoint OSRM demo dipakai untuk pengembangan. Ganti lewat
 * `EXPO_PUBLIC_OSRM_URL` ke server OSRM sendiri (atau penyedia ber-SLA) bila
 * traffic aplikasi sudah tinggi.
 */
const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const DIRECTIONS_ENDPOINT = 'https://maps.googleapis.com/maps/api/directions/json';
const DEFAULT_OSRM_ENDPOINT = 'https://router.project-osrm.org';

/** Batas tunggu tiap penyedia rute; lewat dari ini dianggap gagal. */
const REQUEST_TIMEOUT_MS = 6_000;

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
  /** true = durasi mempertimbangkan lalu lintas (Google Routes API). */
  trafficAware: boolean;
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

interface OsrmResponse {
  code?: string;
  message?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: [number, number][] };
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

function getOsrmEndpoint(): string {
  const raw = process.env.EXPO_PUBLIC_OSRM_URL?.trim() || DEFAULT_OSRM_ENDPOINT;
  return raw.replace(/\/+$/, '');
}

/** Rute cadangan saat API tidak bisa dipakai — UI tetap punya arah & ETA. */
export function straightLineRoute(origin: LatLng, destination: LatLng): TripRoute {
  const distance = haversineMeters(origin, destination);
  return {
    coordinates: [origin, destination],
    distanceMeters: distance,
    durationSeconds: estimateEtaSeconds(distance),
    estimated: true,
    trafficAware: false,
  };
}

function parseDurationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return match ? Math.round(Number(match[1])) : null;
}

/**
 * `fetch` dengan batas waktu sendiri per penyedia. Tanpa ini, satu provider
 * yang menggantung akan menghabiskan jatah waktu provider berikutnya.
 */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Status HTTP dari error bertanda `*_HTTP_<kode>`. */
function httpStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = /HTTP_(\d{3})/.exec(error.message);
  return match ? Number(match[1]) : null;
}

/**
 * 4xx selain timeout/rate-limit biasanya permanen untuk sesi ini: key salah,
 * API belum diaktifkan, atau key dibatasi per layanan. Jangan buang waktu
 * mencoba ulang tiap 20 detik.
 */
function isPermanentHttpError(error: unknown): boolean {
  const status = httpStatus(error);
  return status != null && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/** Routes API (routingPreference TRAFFIC_AWARE → rute & durasi terbaik saat ini). */
async function fetchRoutesApi(
  origin: LatLng,
  destination: LatLng,
  key: string,
): Promise<TripRoute> {
  const response = await fetchWithTimeout(ROUTES_ENDPOINT, {
    method: 'POST',
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
    trafficAware: true,
  };
}

/** Directions API lama — dipakai hanya bila Routes API tidak tersedia. */
async function fetchDirectionsApi(
  origin: LatLng,
  destination: LatLng,
  key: string,
): Promise<TripRoute> {
  const url =
    `${DIRECTIONS_ENDPOINT}?origin=${origin.latitude},${origin.longitude}` +
    `&destination=${destination.latitude},${destination.longitude}` +
    `&mode=driving&departure_time=now&language=id&key=${encodeURIComponent(key)}`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`DIRECTIONS_HTTP_${response.status}`);

  const payload = (await response.json()) as DirectionsResponse;
  if (payload.status !== 'OK') {
    throw new Error(`DIRECTIONS_${payload.status ?? payload.error_message ?? 'ERROR'}`);
  }

  const route = payload.routes?.[0];
  const leg = route?.legs?.[0];
  const coordinates = decodePolyline(route?.overview_polyline?.points ?? '');
  if (coordinates.length < 2) throw new Error('DIRECTIONS_EMPTY');

  const distance = leg?.distance?.value ?? haversineMeters(origin, destination);
  return {
    coordinates,
    distanceMeters: distance,
    durationSeconds:
      leg?.duration_in_traffic?.value ??
      leg?.duration?.value ??
      estimateEtaSeconds(distance),
    estimated: false,
    trafficAware: leg?.duration_in_traffic?.value != null,
  };
}

/**
 * OSRM (OpenStreetMap) — rute jalan nyata tanpa API key.
 *
 * `alternatives=true` lalu pilih durasi tercepat: inilah "rute terbaik" yang
 * ditampilkan saat Google belum/tidak bisa dipakai. Tidak ada data lalu
 * lintas realtime, jadi `trafficAware = false`.
 */
async function fetchOsrmRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<TripRoute> {
  const coords =
    `${origin.longitude},${origin.latitude};` +
    `${destination.longitude},${destination.latitude}`;
  const url =
    `${getOsrmEndpoint()}/route/v1/driving/${coords}` +
    `?alternatives=true&overview=full&geometries=geojson&steps=false`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`OSRM_HTTP_${response.status}`);

  const payload = (await response.json()) as OsrmResponse;
  if (payload.code !== 'Ok') {
    throw new Error(`OSRM_${payload.code ?? payload.message ?? 'ERROR'}`);
  }

  const candidates = (payload.routes ?? []).filter(
    (route) => (route.geometry?.coordinates?.length ?? 0) > 1,
  );
  // Durasi tercepat = rute terbaik. Google juga mengurutkan rute terbaik lebih
  // dulu, tetapi OSRM tidak menjamin urutan saat alternatives diminta.
  candidates.sort(
    (a, b) => (a.duration ?? Number.POSITIVE_INFINITY) - (b.duration ?? Number.POSITIVE_INFINITY),
  );
  const route = candidates[0];
  if (!route?.geometry?.coordinates) throw new Error('OSRM_EMPTY');

  const coordinates = route.geometry.coordinates
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

  const distance = route.distance ?? haversineMeters(origin, destination);
  return {
    coordinates,
    distanceMeters: distance,
    durationSeconds: route.duration ?? estimateEtaSeconds(distance),
    estimated: false,
    trafficAware: false,
  };
}

/** Sekali Google menolak secara permanen, jangan dicoba lagi di sesi ini. */
let routesApiDisabled = false;
let directionsApiDisabled = false;

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
      trafficAware: true,
    };
  }

  const key = getMapsApiKey();
  if (key) {
    if (!routesApiDisabled) {
      try {
        return await fetchRoutesApi(origin, destination, key);
      } catch (error) {
        if (isPermanentHttpError(error)) routesApiDisabled = true;
      }
    }

    if (!directionsApiDisabled) {
      try {
        return await fetchDirectionsApi(origin, destination, key);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (
          isPermanentHttpError(error) ||
          message.includes('DIRECTIONS_REQUEST_DENIED') ||
          message.includes('DIRECTIONS_INVALID_REQUEST')
        ) {
          directionsApiDisabled = true;
        }
      }
    }
  }

  // Google belum siap (API belum diaktifkan / key dibatasi / offline sementara):
  // tetap tampilkan rute jalan nyata lewat OSRM.
  try {
    return await fetchOsrmRoute(origin, destination);
  } catch {
    return straightLineRoute(origin, destination);
  }
}
