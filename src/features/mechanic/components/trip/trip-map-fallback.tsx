import { View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import type { TripRoute } from '@/features/mechanic/tracking/directions';
import { formatDistance, type LatLng } from '@/features/mechanic/tracking/geo';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

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
 * Pengganti peta saat peta tidak bisa dirender (build web atau gagal muat tile).
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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.screen, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={[styles.card, theme.elevation.card]}>
        <Ionicons name="map-outline" size={24} color={theme.colors.actionPrimaryAltBg} />
        <AppText variant="title" style={styles.center}>
          {title}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.center}>
          {hint}
        </AppText>
        <AppText variant="caption" tone="muted" style={[styles.center, theme.tabularNums]}>
          {destination
            ? `Tujuan: ${destination.latitude.toFixed(5)}, ${destination.longitude.toFixed(5)}`
            : 'Menunggu titik lokasi client…'}
        </AppText>
        <AppText variant="caption" tone="muted" style={styles.center}>
          {route
            ? `Rute ${estimated ? 'estimasi' : 'aktif'} · ${formatDistance(route.distanceMeters)}`
            : 'Rute belum dihitung'}
        </AppText>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.xl,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    maxWidth: 420,
  },
  center: {
    textAlign: 'center' as const,
  },
});
