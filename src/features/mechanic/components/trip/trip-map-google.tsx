import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Constants from 'expo-constants';
import { Ionicons } from '@/components/ui/icon';
import { getMapsApiKey } from '@/features/mechanic/tracking/directions';
import type { LatLng } from '@/features/mechanic/tracking/geo';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { TripMapFallback } from './trip-map-fallback';
import type { TripMapProps } from './trip-map-props';

const FALLBACK_CENTER: LatLng = { latitude: -6.2, longitude: 106.816666 };
const FOLLOW_ZOOM = 17;

function initialRegion(mechanic: LatLng | null, destination: LatLng | null): Region {
  const center = mechanic ?? destination ?? FALLBACK_CENTER;
  const spread = mechanic && destination ? 0.02 : 0.01;
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: spread,
    longitudeDelta: spread,
  };
}

/**
 * Peta native `react-native-maps` opsional untuk development build.
 */
export function TripMapGoogle({
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
  const mapRef = useRef<MapView | null>(null);
  const followingRef = useRef(true);
  const fittedOnceRef = useRef(false);
  const lastRecenterRef = useRef(recenterToken);

  const region = useState<Region>(() => initialRegion(mechanic, destination))[0];
  const routeCoordinates = useMemo(() => route?.coordinates ?? [], [route]);
  const mechanicLat = mechanic?.latitude;
  const mechanicLng = mechanic?.longitude;
  const isExpoGo = Constants.expoGoConfig != null;
  const needsDevBuild = Platform.OS === 'android' && isExpoGo;
  const needsGoogleKey = Platform.OS === 'android' && !isExpoGo && getMapsApiKey() == null;

  useEffect(() => {
    if (mode !== 'mechanic') return;
    if (fittedOnceRef.current || routeCoordinates.length < 2) return;
    fittedOnceRef.current = true;
    mapRef.current?.fitToCoordinates(routeCoordinates, {
      edgePadding: { top: topInset + 32, bottom: bottomInset + 32, left: 40, right: 40 },
      animated: true,
    });
  }, [mode, routeCoordinates, topInset, bottomInset]);

  const viewerCoordinates = useMemo(() => {
    if (mode !== 'client') return [];
    if (routeCoordinates.length > 1) return routeCoordinates;
    return mechanic && destination ? [mechanic, destination] : [];
  }, [mode, routeCoordinates, mechanic, destination]);

  useEffect(() => {
    if (mode !== 'client' || viewerCoordinates.length < 2) return;
    mapRef.current?.fitToCoordinates(viewerCoordinates, {
      edgePadding: { top: 28, bottom: 28, left: 28, right: 28 },
      animated: true,
    });
  }, [mode, viewerCoordinates]);

  useEffect(() => {
    if (mode !== 'mechanic') return;
    if (recenterToken === lastRecenterRef.current) return;
    lastRecenterRef.current = recenterToken;
    followingRef.current = true;
    onFollowChange?.(true);
    if (mechanicLat != null && mechanicLng != null) {
      mapRef.current?.animateCamera(
        { center: { latitude: mechanicLat, longitude: mechanicLng }, zoom: FOLLOW_ZOOM },
        { duration: 600 },
      );
    }
  }, [mode, recenterToken, mechanicLat, mechanicLng, onFollowChange]);

  useEffect(() => {
    if (mode !== 'mechanic') return;
    if (mechanicLat == null || mechanicLng == null || !followingRef.current) return;
    mapRef.current?.animateCamera(
      { center: { latitude: mechanicLat, longitude: mechanicLng }, zoom: FOLLOW_ZOOM },
      { duration: 900 },
    );
  }, [mode, mechanicLat, mechanicLng]);

  if (needsDevBuild) {
    return (
      <TripMapFallback
        destination={destination}
        route={route}
        estimated={estimated}
        topInset={topInset}
        bottomInset={bottomInset}
        title="Peta butuh development build"
        hint="Expo Go tidak lagi mendukung Google Maps di Android. Gunakan renderer WebView Leaflet atau build development."
      />
    );
  }

  if (needsGoogleKey) {
    return (
      <TripMapFallback
        destination={destination}
        route={route}
        estimated={estimated}
        topInset={topInset}
        bottomInset={bottomInset}
        title="Peta butuh Google Maps API key"
        hint="Isi EXPO_PUBLIC_MAPS_API_KEY lalu build ulang development build untuk menampilkan peta."
      />
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={region}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      pitchEnabled={false}
      mapPadding={{ top: topInset, right: 0, bottom: bottomInset, left: 0 }}
      onPanDrag={() => {
        followingRef.current = false;
        onFollowChange?.(false);
      }}
    >
      {routeCoordinates.length > 1 ? (
        <>
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={theme.colors.bgSurface}
            strokeWidth={9}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={theme.colors.actionPrimaryAltBg}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
            lineDashPattern={estimated ? [10, 8] : undefined}
            zIndex={2}
          />
        </>
      ) : null}

      {destination ? (
        <Marker
          coordinate={destination}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          title="Lokasi client"
        >
          <View style={styles.destinationPin}>
            <Ionicons name="home" size={16} color={theme.colors.actionPrimaryAltBg} />
          </View>
        </Marker>
      ) : null}

      {mechanic ? (
        <Marker
          coordinate={mechanic}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          title="Posisi kamu"
        >
          <View style={styles.mechanicHalo}>
            <View style={styles.mechanicDot}>
              <Ionicons
                name="navigate"
                size={16}
                color={theme.colors.actionPrimaryFg}
                style={{ transform: [{ rotate: `${heading ?? 0}deg` }] }}
              />
            </View>
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
}

const createStyles = (theme: AppTheme) => ({
  destinationPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 2,
    borderColor: theme.colors.actionPrimaryAltBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...theme.elevation.card,
  },
  mechanicHalo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  mechanicDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.actionPrimaryAltBg,
    borderWidth: 2,
    borderColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
