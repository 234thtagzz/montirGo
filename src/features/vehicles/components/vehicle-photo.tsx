import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useForegroundEpoch } from '@/hooks/use-foreground';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { forgetVehiclePhotoUrl, resolveVehiclePhotoUrl } from '../photo';

interface VehiclePhotoProps {
  value?: string | null;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  emptyLabel?: string | null;
}

/**
 * Foto kendaraan dari bucket privat `vehicle-photos` via signed URL ber-cache.
 */
export function VehiclePhoto({
  value,
  height,
  borderRadius,
  style,
  emptyLabel = 'Belum ada foto kendaraan',
}: VehiclePhotoProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const resolvedRadius = borderRadius ?? theme.radii.md;
  const foregroundEpoch = useForegroundEpoch();
  const [resolved, setResolved] = useState<{ key: string; uri: string | null } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    let active = true;

    resolveVehiclePhotoUrl(value, { force: reloadToken > 0 })
      .then((url) => {
        if (active) setResolved({ key: value, uri: url });
      })
      .catch(() => {
        if (active) setResolved({ key: value, uri: null });
      });

    return () => {
      active = false;
    };
  }, [value, foregroundEpoch, reloadToken]);

  const uri = value && resolved?.key === value ? resolved.uri : null;
  const loading = Boolean(value) && resolved?.key !== value;

  const handleImageError = () => {
    if (!value) return;
    if (failedFor === value) {
      setResolved({ key: value, uri: null });
      return;
    }
    setFailedFor(value);
    forgetVehiclePhotoUrl(value);
    setReloadToken((token) => token + 1);
  };

  return (
    <View
      style={[
        styles.frame,
        { height, borderRadius: resolvedRadius },
        !uri && styles.placeholder,
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          onError={handleImageError}
        />
      ) : loading ? (
        <ActivityIndicator size="small" color={theme.colors.actionPrimaryAltBg} />
      ) : (
        <>
          <Ionicons name="image-outline" size={24} color={theme.colors.textMuted} />
          {emptyLabel ? (
            <AppText variant="caption" tone="muted" style={styles.emptyText}>
              {emptyLabel}
            </AppText>
          ) : null}
        </>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  frame: {
    width: '100%' as const,
    overflow: 'hidden' as const,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  placeholder: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    borderStyle: 'dashed' as const,
  },
  image: {
    width: '100%' as const,
    height: '100%' as const,
  },
  emptyText: {
    textAlign: 'center' as const,
    paddingHorizontal: theme.spacing.md,
  },
});
