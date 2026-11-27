import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { TripMapFallback } from './trip-map-fallback';
import { buildTripMapHtml, getMapThemeTokens } from './trip-map-html';
import type { TripMapProps } from './trip-map-props';

interface BridgeMessage {
  type?: 'ready' | 'follow' | 'error';
  value?: boolean;
  code?: string;
}

/**
 * Peta berbasis WebView (Leaflet terbundel lokal + tile raster + Dark Mode live).
 */
export function TripMapWebView({
  mechanic,
  heading,
  destination,
  route,
  estimated,
  mode = 'mechanic',
  topInset,
  bottomInset,
  recenterToken,
  onFollowChange,
}: TripMapProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const webRef = useRef<ComponentRef<typeof WebView>>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastRecenterRef = useRef(recenterToken);

  const mapTokens = useMemo(() => getMapThemeTokens(theme), [theme]);
  // Simpan token awal agar HTML dibangun sekali saja; perubahan tema berikutnya
  // disuntikkan via `window.TripMap.setTheme` tanpa memuat ulang WebView.
  const [initialTokens] = useState(() => mapTokens);
  const html = useMemo(() => buildTripMapHtml(initialTokens), [initialTokens]);

  const run = useCallback(
    (script: string) => {
      if (!ready) return;
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
    run(`window.TripMap.setTheme(${JSON.stringify(mapTokens)});`);
  }, [run, mapTokens]);

  useEffect(() => {
    run(`window.TripMap.setInsets(${Math.round(topInset)}, ${Math.round(bottomInset)});`);
  }, [run, topInset, bottomInset]);

  useEffect(() => {
    run(`window.TripMap.setMode(${JSON.stringify(mode)});`);
  }, [run, mode]);

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

  if (Platform.OS === 'web' || failed) {
    return (
      <TripMapFallback
        destination={destination}
        route={route}
        estimated={estimated}
        topInset={topInset}
        bottomInset={bottomInset}
        title={Platform.OS === 'web' ? 'Pratinjau peta tersedia di perangkat mobile' : 'Peta tidak bisa dimuat'}
        hint={
          Platform.OS === 'web'
            ? 'Gunakan aplikasi Android / iOS untuk navigasi peta interaktif.'
            : 'Periksa koneksi internet untuk memuat petak peta. Leaflet sudah terpasang lokal.'
        }
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
          <ActivityIndicator color={theme.colors.actionPrimaryAltBg} />
          <AppText variant="caption" tone="muted">
            Memuat peta…
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  web: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  loading: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.bgCanvas,
  },
});
