import type { TripRoute } from '@/features/mechanic/tracking/directions';
import type { LatLng } from '@/features/mechanic/tracking/geo';

export interface TripMapProps {
  /** Posisi montir saat ini. */
  mechanic: LatLng | null;
  /** Arah hadap montir (0-360°) untuk memutar ikon navigasi. */
  heading: number | null;
  /** Titik lokasi client. */
  destination: LatLng | null;
  /** Rute dari Directions (atau garis lurus saat fallback). */
  route: TripRoute | null;
  /** true = rute estimasi, digambar putus-putus. */
  estimated: boolean;
  /**
   * `mechanic` (default): kamera mengikuti posisi montir seperti layar navigasi.
   * `client`: kamera membingkai seluruh rute agar montir dan lokasi client
   * sama-sama terlihat (dipakai di kartu pelacakan client).
   */
  mode?: 'mechanic' | 'client';
  /** Ruang di atas peta yang tertutup kartu status. */
  topInset: number;
  /** Ruang di bawah peta yang tertutup bottom sheet. */
  bottomInset: number;
  /** Naikkan nilai ini untuk memaksa kamera kembali mengikuti montir. */
  recenterToken: number;
  /** Dipanggil saat pengguna menggeser peta sendiri. */
  onFollowChange?: (following: boolean) => void;
}
