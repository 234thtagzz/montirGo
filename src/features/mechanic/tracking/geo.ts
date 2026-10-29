/** Perhitungan geospasial kecil untuk layar perjalanan montir. */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

/** Kecepatan rata-rata motor di kota, dipakai saat Directions tidak tersedia. */
export const CITY_SPEED_KMH = 25;

const toRadians = (value: number) => (value * Math.PI) / 180;

export function haversineMeters(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Arah pergerakan (0-360°) dari satu titik ke titik lain. */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function estimateEtaSeconds(meters: number, speedKmh = CITY_SPEED_KMH): number {
  if (!Number.isFinite(meters) || meters <= 0) return 0;
  return Math.max(30, Math.round((meters / 1000 / speedKmh) * 3600));
}

/** Jarak ringkas ala aplikasi transportasi: "850 m", "3,4 km". */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return `${rounded} m`;
  }
  const km = meters / 1000;
  return `${km.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
}

/** Durasi ringkas: "1 mnt", "12 mnt", "1 j 05 mnt". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} mnt`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} j` : `${hours} j ${minutes} mnt`;
}

/** Perkiraan jam tiba, mis. "±14.32". */
export function formatArrivalClock(secondsFromNow: number | null | undefined): string | null {
  if (secondsFromNow == null || !Number.isFinite(secondsFromNow)) return null;
  const arrival = new Date(Date.now() + secondsFromNow * 1000);
  return `±${arrival.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function isWithinRadius(from: LatLng, to: LatLng, radiusMeters: number): boolean {
  return haversineMeters(from, to) <= radiusMeters;
}
