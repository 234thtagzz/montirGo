import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { buildPinPickerMapHtml, getMapThemeTokens } from '@/features/mechanic/components/trip/trip-map-html';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

const DEFAULT_COORDS = { lat: -6.2, lng: 106.816666 };

interface LocationPinPickerSheetProps {
  visible: boolean;
  initialCoords: { lat: number; lng: number } | null;
  gpsCoords: { lat: number; lng: number } | null;
  onConfirm: (coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

interface PinMessage {
  type?: 'ready' | 'center' | 'error';
  lat?: number;
  lng?: number;
}

/**
 * Pemilih titik lokasi Leaflet secara lazy (hanya mount WebView saat dibuka).
 */
export function LocationPinPickerSheet({
  visible,
  initialCoords,
  gpsCoords,
  onConfirm,
  onClose,
}: LocationPinPickerSheetProps) {
  if (!visible) return null;

  return (
    <LocationPinPickerContent
      initialCoords={initialCoords}
      gpsCoords={gpsCoords}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

function LocationPinPickerContent({
  initialCoords,
  gpsCoords,
  onConfirm,
  onClose,
}: Omit<LocationPinPickerSheetProps, 'visible'>) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const webRef = useRef<ComponentRef<typeof WebView>>(null);

  const startCoords = initialCoords ?? gpsCoords ?? DEFAULT_COORDS;
  const [coords, setCoords] = useState(startCoords);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const mapTokens = useMemo(() => getMapThemeTokens(theme), [theme]);
  const [initialTokens] = useState(() => mapTokens);
  const [initialCenter] = useState(() => startCoords);
  const html = useMemo(
    () => buildPinPickerMapHtml(initialTokens, initialCenter),
    [initialTokens, initialCenter],
  );

  const run = useCallback(
    (script: string) => {
      if (!ready) return;
      webRef.current?.injectJavaScript(`${script} true;`);
    },
    [ready],
  );

  useEffect(() => {
    run(`window.PinMap.setTheme(${JSON.stringify(mapTokens)});`);
  }, [run, mapTokens]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as PinMessage;
      if (payload.type === 'ready') {
        setReady(true);
      } else if (
        payload.type === 'center' &&
        typeof payload.lat === 'number' &&
        typeof payload.lng === 'number'
      ) {
        setCoords({ lat: payload.lat, lng: payload.lng });
      } else if (payload.type === 'error') {
        setFailed(true);
      }
    } catch {
      // Abaikan pesan non-JSON.
    }
  }, []);

  const recenterToGps = () => {
    if (!gpsCoords) return;
    setCoords(gpsCoords);
    run(`window.PinMap.setCenter(${gpsCoords.lat}, ${gpsCoords.lng});`);
  };

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, theme.spacing.md) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tutup peta"
            onPress={onClose}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <AppText variant="title">Geser Peta ke Titik Lokasi</AppText>
            <AppText variant="caption" tone="muted">
              Arahkan pin tengah tepat ke posisi kendaraanmu
            </AppText>
          </View>
        </View>

        <View style={styles.mapWrap}>
          {Platform.OS === 'web' || failed ? (
            <View style={styles.webFallback}>
              <Ionicons name="map-outline" size={28} color={theme.colors.actionPrimaryAltBg} />
              <AppText variant="title" style={styles.centerText}>
                {Platform.OS === 'web' ? 'Pratinjau pin tersedia di mobile' : 'Tile peta tidak merespons'}
              </AppText>
              <AppText variant="body" tone="secondary" style={styles.centerText}>
                Koordinat saat ini tetap siap digunakan, atau isi patokan alamat manual di form.
              </AppText>
            </View>
          ) : (
            <>
              <WebView
                ref={webRef}
                source={{ html }}
                originWhitelist={['*']}
                style={styles.web}
                scrollEnabled={false}
                bounces={false}
                javaScriptEnabled
                domStorageEnabled
                androidLayerType="hardware"
                onMessage={handleMessage}
                onError={() => setFailed(true)}
              />

              {!ready ? (
                <View pointerEvents="none" style={styles.loadingOverlay}>
                  <ActivityIndicator color={theme.colors.actionPrimaryAltBg} />
                  <AppText variant="caption" tone="muted">
                    Menyiapkan peta…
                  </AppText>
                </View>
              ) : null}

              <View pointerEvents="none" style={styles.crosshair}>
                <View style={styles.pinBadge}>
                  <Ionicons name="location" size={26} color={theme.colors.actionEmergencyFg} />
                </View>
                <View style={styles.pinShadowDot} />
              </View>

              {gpsCoords ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pusatkan ke GPS saya"
                  onPress={recenterToGps}
                  style={({ pressed }) => [styles.recenterBtn, theme.elevation.sheet, pressed && styles.pressed]}
                >
                  <Ionicons name="locate" size={18} color={theme.colors.actionPrimaryAltBg} />
                  <AppText variant="label" tone="info">
                    Ke GPS Saya
                  </AppText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        <View
          style={[
            styles.footer,
            theme.elevation.sheet,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.md) + theme.spacing.sm },
          ]}
        >
          <View style={styles.coordBox}>
            <AppText variant="overline" tone="muted">
              KOORDINAT PIN
            </AppText>
            <AppText variant="bodyStrong" style={theme.tabularNums}>
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </AppText>
          </View>

          <Button
            label="Gunakan Titik Ini"
            variant="emergency"
            size="cta"
            icon="checkmark-circle-outline"
            onPress={() => onConfirm(coords)}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  mapWrap: {
    flex: 1,
    position: 'relative' as const,
    backgroundColor: theme.colors.bgCanvas,
  },
  web: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  loadingOverlay: {
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
  webFallback: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  centerText: {
    textAlign: 'center' as const,
  },
  crosshair: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingBottom: 28,
  },
  pinBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.actionEmergencyBg,
    borderWidth: 2,
    borderColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pinShadowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    backgroundColor: theme.colors.actionPrimaryBg,
  },
  recenterBtn: {
    position: 'absolute' as const,
    right: theme.spacing.lg,
    bottom: theme.spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    minHeight: 48,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  footer: {
    backgroundColor: theme.colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  coordBox: {
    gap: theme.spacing.xxs,
  },
  pressed: { opacity: 0.78 },
});
