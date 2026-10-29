import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Brand, Space } from '@/constants/brand';
import { TripMapFallback } from './trip-map-fallback';
import { buildTripMapHtml } from './trip-map-html';
import type { TripMapProps } from './trip-map-props';

interface BridgeMessage {
  type?: 'ready' | 'follow' | 'error';
  value?: boolean;
  code?: string;
}

/**
 * Peta berbasis WebView (Leaflet + tile raster).
 *
 * Dipilih sebagai renderer default karena tetap menampilkan rute perjalanan di
 * Expo Go — `react-native-maps` di Expo Go Android hanya menghasilkan petak
 * kosong/hitam sejak SDK 52.
 */
export function TripMapWebView({
  mechanic,
  heading,
  destination,
  route,
  estimated,
  topInset,
  bottomInset,
  recenterToken,
  onFollowChange,
}: TripMapProps) {
  const webRef = useRef<WebView | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastRecenterRef = useRef(recenterToken);

  const html = useMemo(() => buildTripMapHtml(), []);

  const run = useCallback(
    (script: string) => {
      if (!ready) return;
      // `true;` menutup evaluasi agar WebView iOS tidak menganggap hasilnya kosong.
      webRef.current?.injectJavaScript(`${script} true;`);
    },
    [ready],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data) as BridgeMessage;
        if (payload.type === 'ready') {
          setReady(true);
        } else if (payload.type === 'follow') {
          onFollowChange?.(payload.value ?? false);
        } else if (payload.type === 'error') {
          setFailed(true);
        }
      } catch {
        // Pesan non-JSON dari halaman diabaikan.
      }
    },
    [onFollowChange],
  );

  useEffect(() => {
    run(`window.TripMap.setInsets(${Math.round(topInset)}, ${Math.round(bottomInset)});`);
  }, [run, topInset, bottomInset]);

  const destinationLat = destination?.latitude;
  const destinationLng = destination?.longitude;
  useEffect(() => {
    if (destinationLat == null || destinationLng == null) return;
    run(`window.TripMap.setDestination(${destinationLat}, ${destinationLng});`);
  }, [run, destinationLat, destinationLng]);

  const mechanicLat = mechanic?.latitude;
  const mechanicLng = mechanic?.longitude;
  useEffect(() => {
    if (mechanicLat == null || mechanicLng == null) return;
    run(`window.TripMap.setMechanic(${mechanicLat}, ${mechanicLng}, ${heading ?? 0});`);
  }, [run, mechanicLat, mechanicLng, heading]);

  useEffect(() => {
    const points = (route?.coordinates ?? []).map((point) => [
      point.latitude,
      point.longitude,
    ]);
    // `fit` diserahkan ke halaman web: hanya bingkai rute pada rute pertama.
    run(
      `window.TripMap.setRoute(${JSON.stringify(points)}, ${
        estimated ? 'true' : 'false'
      }, true);`,
    );
  }, [run, route, estimated]);

  useEffect(() => {
    if (recenterToken === lastRecenterRef.current) return;
    lastRecenterRef.current = recenterToken;
    onFollowChange?.(true);
    run('window.TripMap.recenter();');
  }, [run, recenterToken, onFollowChange]);

  if (failed) {
    return (
      <TripMapFallback
        destination={destination}
        route={route}
        estimated={estimated}
        topInset={topInset}
        bottomInset={bottomInset}
        title="Peta tidak bisa dimuat"
        hint="Periksa koneksi internet, lalu buka ulang layar ini. Peta memakai WebView + tile OpenStreetMap."
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={['*']}
        style={styles.web}
        containerStyle={styles.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        onMessage={handleMessage}
        onError={() => setFailed(true)}
      />

      {!ready ? (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color={Brand.primary} />
          <Text style={styles.loadingText}>Memuat peta…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: '#EEF2F7' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    backgroundColor: '#EEF2F7',
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.textMuted,
  },
});
