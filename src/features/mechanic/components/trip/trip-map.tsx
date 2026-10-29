import { TripMapGoogle } from './trip-map-google';
import { TripMapWebView } from './trip-map-webview';
import type { TripMapProps } from './trip-map-props';

/**
 * Renderer peta layar perjalanan.
 *
 * - `webview` (default): Leaflet + tile raster di WebView. Jalan di **Expo Go**
 *   maupun development build, tanpa Google Maps SDK / API key.
 * - `google`: `react-native-maps` native. Lebih halus & mendukung trafik Google,
 *   tetapi hanya tampil di development build (Expo Go Android kosong/hitam).
 */
const MAP_RENDERER: 'webview' | 'google' = 'webview';

export function TripMap(props: TripMapProps) {
  return MAP_RENDERER === 'google' ? <TripMapGoogle {...props} /> : <TripMapWebView {...props} />;
}
