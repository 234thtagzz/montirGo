import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface AssignmentPendingCardProps {
  /** Batas waktu client mengonfirmasi; null bila tidak diketahui. */
  expiresAt?: string | null;
  onPress?: () => void;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Pemberitahuan untuk montir bahwa pengajuannya masih menunggu konfirmasi
 * client (`mechanic_assigned`). Montir baru berangkat setelah pengajuan disetujui.
 */
export function AssignmentPendingCard({ expiresAt, onPress }: AssignmentPendingCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [expiresAt]);

  const rawRemaining =
    expiresAt == null || now === 0 ? null : Math.max(0, new Date(expiresAt).getTime() - now);
  const remaining =
    rawRemaining == null ? null : Math.min(5 * 60 * 1000, rawRemaining);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel="Menunggu konfirmasi client"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && onPress && styles.pressed]}
    >
      <Surface variant="outlined" padding="md" style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="hourglass-outline"
            size={20}
            color={theme.colors.statusWarningFg}
          />
        </View>
        <View style={styles.copy}>
          <AppText variant="bodyStrong">Menunggu konfirmasi client</AppText>
          <AppText variant="caption" tone="secondary" style={styles.desc}>
            Client sedang meninjau profil & ratingmu. Kamu bisa berangkat setelah pengajuan
            disetujui.
          </AppText>
        </View>
        {remaining != null ? (
          <View style={styles.countdown}>
            <AppText
              variant="label"
              tabular
              style={{ color: theme.colors.statusWarningFg }}
            >
              {formatRemaining(remaining)}
            </AppText>
          </View>
        ) : null}
      </Surface>
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    marginTop: theme.spacing.md,
  },
  pressed: {
    opacity: 0.88,
  },
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.statusWarningBg,
    borderColor: theme.colors.statusWarningBorder,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  desc: {
    lineHeight: 16,
  },
  countdown: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.sm,
    borderCurve: theme.components.card.borderCurve,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
  },
});
