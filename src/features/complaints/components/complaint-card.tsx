import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useForegroundEpoch } from '@/hooks/use-foreground';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';
import { forgetComplaintPhotoUrl, resolveComplaintPhotoUrl } from '../photo';
import { COMPLAINT_CATEGORY_META, COMPLAINT_STATUS_META, type Complaint } from '../types';

const MAX_THUMBNAILS = 3;

export function ComplaintCard({ complaint }: { complaint: Complaint }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const meta = COMPLAINT_STATUS_META[complaint.status];
  const category = COMPLAINT_CATEGORY_META[complaint.category] ?? {
    label: complaint.category,
    icon: 'alert-circle-outline' as const,
  };
  const foregroundEpoch = useForegroundEpoch();
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const retried = useRef(new Set<string>());

  const paths = complaint.photo_paths.slice(0, MAX_THUMBNAILS);
  const pathsKey = paths.join('|');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const urls = await Promise.all(paths.map((path) => resolveComplaintPhotoUrl(path)));
      if (alive) setPhotoUrls(urls);
    };
    void load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey, foregroundEpoch, reloadToken]);

  const handlePhotoError = (path: string, index: number) => {
    if (retried.current.has(path)) {
      setPhotoUrls((current) => current.map((url, i) => (i === index ? null : url)));
      return;
    }
    retried.current.add(path);
    forgetComplaintPhotoUrl(path);
    setReloadToken((token) => token + 1);
  };

  return (
    <Surface variant="default" padding="lg" style={styles.card}>
      <View style={styles.topRow}>
        <Badge label={meta.label} tone={meta.tone} icon={meta.icon} size="sm" />
        <AppText variant="caption" tone="muted">
          {formatDateTime(complaint.created_at)}
        </AppText>
      </View>

      <AppText variant="title">{complaint.subject}</AppText>
      <AppText variant="body" tone="secondary" numberOfLines={3}>
        {complaint.description}
      </AppText>

      <View style={styles.metaRow}>
        <Ionicons name={category.icon} size={13} color={theme.colors.textMuted} />
        <AppText variant="caption" tone="muted">
          {category.label}
        </AppText>
        <View style={styles.dot} />
        <AppText variant="caption" tone="muted" style={theme.tabularNums}>
          #{complaint.request_id.slice(0, 8).toUpperCase()}
        </AppText>
      </View>

      {paths.length > 0 ? (
        <View style={styles.photoRow}>
          {paths.map((path, index) =>
            photoUrls[index] ? (
              <Image
                key={path}
                source={{ uri: photoUrls[index] }}
                style={styles.photo}
                contentFit="cover"
                transition={120}
                onError={() => handlePhotoError(path, index)}
              />
            ) : (
              <View key={path} style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={18} color={theme.colors.textMuted} />
              </View>
            ),
          )}
        </View>
      ) : null}

      {complaint.admin_reply ? (
        <View style={styles.replyBox}>
          <View style={styles.replyHead}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={14}
              color={theme.colors.statusInfoFg}
            />
            <AppText variant="overline" tone="info">
              Balasan admin
            </AppText>
          </View>
          <AppText variant="body">{complaint.admin_reply}</AppText>
        </View>
      ) : null}
    </Surface>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xxs,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.textMuted,
  },
  photoRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurfaceSubtle,
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  replyBox: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.statusInfoBg,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xxs,
  },
  replyHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
});
