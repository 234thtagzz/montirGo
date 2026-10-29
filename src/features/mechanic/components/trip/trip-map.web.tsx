import { TripMapFallback } from './trip-map-fallback';
import type { TripMapProps } from './trip-map-props';

/**
 * Fallback web: react-native-maps tidak tersedia di browser. Layar tetap
 * menampilkan ringkasan rute agar build web tidak crash dan alur bisa diuji.
 */
export function TripMap({ destination, route, estimated, topInset, bottomInset }: TripMapProps) {
  return (
    <TripMapFallback
      destination={destination}
      route={route}
      estimated={estimated}
      topInset={topInset}
      bottomInset={bottomInset}
      title="Peta tersedia di aplikasi Android/iOS"
      hint="Jalankan versi native (development build) untuk navigasi peta realtime."
    />
  );
}
