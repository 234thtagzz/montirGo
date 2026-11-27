import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import type { NearbyMechanic } from '@/features/client/types';
import { forgetWorkshopPhotoUrl, resolveWorkshopPhotoUrls } from '@/features/mechanic/photo';
import { formatSpecializations } from '@/features/mechanic/specializations';
import { useForegroundEpoch } from '@/hooks/use-foreground';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface NearbyMechanicsProps {
  mechanics: NearbyMechanic[];
}

function useWorkshopPhotos(mechanics: NearbyMechanic[]) {
  const foregroundEpoch = useForegroundEpoch();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [reloadToken, setReloadToken] = useState(0);
  const key = mechanics.map((item) => item.workshop_photo ?? '').join('|');

  useEffect(() => {
    const paths = mechanics
      .map((item) => item.workshop_photo)
      .filter((path): path is string => !!path);
    if (paths.length === 0) return;
    let active = true;
    resolveWorkshopPhotoUrls(paths)
      .then((resolved) => {
        if (active) setUrls(resolved);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, foregroundEpoch, reloadToken]);

  const retry = useCallback((path: string) => {
    forgetWorkshopPhotoUrl(path);
    setReloadToken((token) => token + 1);
  }, []);

  return { urls, retry };
}

export function NearbyMechanics({ mechanics }: NearbyMechanicsProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { urls: photoUrls, retry } = useWorkshopPhotos(mechanics);
  const retried = useRef(new Set<string>());
  const [failedPaths, setFailedPaths] = useState<Set<string>>(new Set());

  const handlePhotoError = (path: string) => {
    if (retried.current.has(path)) {
      setFailedPaths((current) => {
        if (current.has(path)) return current;
        const next = new Set(current);
        next.add(path);
        return next;
      });
      return;
    }
    retried.current.add(path);
    retry(path);
  };

  if (mechanics.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="moon-outline" size={20} color={theme.colors.textSecondary} />
        <View style={styles.emptyCopy}>
          <AppText variant="label">Belum ada montir online</AppText>
          <AppText variant="caption" tone="secondary">
            Kamu tetap bisa membuat permintaan — montir yang siap akan langsung menerima.
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {mechanics.map((mechanic) => {
        const name = mechanic.full_name?.trim() || 'Montir MontirGo';
        const specialization = formatSpecializations(mechanic.vehicle_specialization);
        const workshopPath = mechanic.workshop_photo ?? '';
        const workshopPhoto =
          workshopPath && !failedPaths.has(workshopPath) ? photoUrls[workshopPath] ?? null : null;
        const workshopName = mechanic.workshop_name?.trim() || 'Montir panggilan';

        return (
          <View key={mechanic.profile_id} style={[styles.card, theme.elevation.card]}>
            <View style={styles.media}>
              {workshopPhoto ? (
                <Image
                  source={{ uri: workshopPhoto }}
                  style={styles.workshopPhoto}
                  contentFit="cover"
                  transition={150}
                  onError={() => handlePhotoError(workshopPath)}
                />
              ) : (
                <View style={styles.mediaFallback}>
                  <Avatar name={name} uri={mechanic.avatar_url} size={48} />
                </View>
              )}
              {workshopPhoto ? (
                <View style={styles.avatarOverlay}>
                  <Avatar name={name} uri={mechanic.avatar_url} size={36} />
                </View>
              ) : null}
              <View style={styles.onlineChipWrap}>
                <Badge label="Siaga" tone="success" dot size="sm" />
              </View>
            </View>

            <AppText variant="label" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {workshopName}
            </AppText>

            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={theme.colors.statusWarningFg} />
              <AppText variant="caption" style={[styles.rating, theme.tabularNums]}>
                {mechanic.rating_avg.toFixed(1)}
              </AppText>
              <AppText variant="caption" tone="muted">
                ·
              </AppText>
              <AppText variant="caption" tone="muted" style={theme.tabularNums}>
                {mechanic.total_jobs} job
              </AppText>
            </View>

            {specialization ? (
              <View style={styles.specChip}>
                <AppText variant="caption" tone="info" numberOfLines={1}>
                  {specialization}
                </AppText>
              </View>
            ) : (
              <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.specPlaceholder}>
                {mechanic.experience_years
                  ? `${mechanic.experience_years} tahun pengalaman`
                  : 'Montir terverifikasi'}
              </AppText>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) => ({
  row: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xs,
  },
  card: {
    width: 184,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  media: {
    marginBottom: theme.spacing.md,
  },
  workshopPhoto: {
    width: '100%' as const,
    height: 78,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  mediaFallback: {
    height: 78,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarOverlay: {
    position: 'absolute' as const,
    left: 6,
    bottom: -10,
    borderRadius: theme.radii.pill,
    borderWidth: 2,
    borderColor: theme.colors.bgSurface,
  },
  onlineChipWrap: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
  },
  ratingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  rating: {
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.textPrimary,
  },
  specChip: {
    alignSelf: 'flex-start' as const,
    maxWidth: '100%' as const,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.xs,
    backgroundColor: theme.colors.statusInfoBg,
    marginTop: theme.spacing.sm,
  },
  specPlaceholder: {
    marginTop: theme.spacing.sm,
  },
  empty: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: theme.spacing.lg,
  },
  emptyCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
});
