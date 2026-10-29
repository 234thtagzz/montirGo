import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Constants from 'expo-constants';
import { Ionicons } from '@/components/ui/icon';
import { Brand } from '@/constants/brand';
import type { LatLng } from '@/features/mechanic/tracking/geo';
import { getMapsApiKey } from '@/features/mechanic/tracking/directions';
import { TripMapFallback } from './trip-map-fallback';
import type { TripMapProps } from './trip-map-props';

/** Titik tengah Jakarta sebagai fallback sebelum GPS tersedia. */
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
 * Peta native `react-native-maps` (Google Maps di Android, Apple Maps di iOS).
 *
 * Hanya bisa dipakai di **development build** — Expo Go tidak lagi mendukung
 * Google Maps di Android (petak peta kosong/hitam). Dipilih lewat konstanta
 * `MAP_RENDERER` pada `trip-map.tsx`.
 */
export function TripMapGoogle({
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
  // Di development build, Android butuh key di manifest agar petak tampil.
  const needsGoogleKey = Platform.OS === 'android' && !isExpoGo && getMapsApiKey() == null;

  // Saat rute pertama kali tersedia: tampilkan seluruh perjalanan.
  useEffect(() => {
    if (fittedOnceRef.current || routeCoordinates.length < 2) return;
    fittedOnceRef.current = true;
    mapRef.current?.fitToCoordinates(routeCoordinates, {
      edgePadding: { top: topInset + 32, bottom: bottomInset + 32, left: 40, right: 40 },
      animated: true,
    });
  }, [routeCoordinates, topInset, bottomInset]);

  // Tombol "recenter" ditekan: kembali mengikuti montir.
  useEffect(() => {
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
  }, [recenterToken, mechanicLat, mechanicLng, onFollowChange]);

  // Ikuti montir selama pengguna belum menggeser peta.
  useEffect(() => {
    if (mechanicLat == null || mechanicLng == null || !followingRef.current) return;
    mapRef.current?.animateCamera(
      { center: { latitude: mechanicLat, longitude: mechanicLng }, zoom: FOLLOW_ZOOM },
      { duration: 900 },
    );
  }, [mechanicLat, mechanicLng]);

  if (needsDevBuild) {
    return (
      <TripMapFallback
        destination={destination}
        route={route}
        estimated={estimated}
        topInset={topInset}
        bottomInset={bottomInset}
        title="Peta butuh development build"
        hint="Expo Go tidak lagi mendukung Google Maps di Android. Jalankan `npx expo run:android` atau `eas build --profile development`, lalu buka aplikasi hasil build tersebut."
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
        hint="Isi EXPO_PUBLIC_MAPS_API_KEY lalu build ulang aplikasi (development build) untuk menampilkan peta."
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
            strokeColor="rgba(255,255,255,0.95)"
            strokeWidth={9}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={Brand.primary}
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
            <Ionicons name="home" size={16} color={Brand.primary} />
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
                color={Brand.white}
                style={{ transform: [{ rotate: `${heading ?? 0}deg` }] }}
              />
            </View>
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  destinationPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.white,
    borderWidth: 2,
    borderColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1B33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  mechanicHalo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(11,116,229,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mechanicDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Brand.primary,
    borderWidth: 2,
    borderColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
