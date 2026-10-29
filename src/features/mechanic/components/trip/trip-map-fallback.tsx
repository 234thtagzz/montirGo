import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, Space } from '@/constants/brand';
import { formatDistance, type LatLng } from '@/features/mechanic/tracking/geo';
import type { TripRoute } from '@/features/mechanic/tracking/directions';

interface TripMapFallbackProps {
  destination: LatLng | null;
  route: TripRoute | null;
  estimated: boolean;
  topInset: number;
  bottomInset: number;
  title: string;
  hint: string;
}

/**
 * Pengganti peta saat peta native tidak bisa dirender: build web, atau Android
 * yang belum diberi Google Maps API key. Rute & koordinat tetap ditampilkan agar
 * montir punya informasi dan tidak melihat kotak abu-abu kosong.
 */
export function TripMapFallback({
  destination,
  route,
  estimated,
  topInset,
  bottomInset,
  title,
  hint,
}: TripMapFallbackProps) {
  return (
    <View style={[styles.screen, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.card}>
        <Ionicons name="map-outline" size={22} color={Brand.primary} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
        <Text style={styles.hint}>
          {destination
            ? `Tujuan: ${destination.latitude.toFixed(5)}, ${destination.longitude.toFixed(5)}`
            : 'Menunggu titik lokasi client…'}
        </Text>
        <Text style={styles.hint}>
          {route
            ? `Rute ${estimated ? 'estimasi' : 'aktif'} · ${formatDistance(route.distanceMeters)}`
            : 'Rute belum dihitung'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
  },
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.xl,
    alignItems: 'center',
    gap: Space.sm,
    maxWidth: 420,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
});
