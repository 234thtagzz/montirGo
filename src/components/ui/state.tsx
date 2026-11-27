import { ActivityIndicator, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export function LoadingState({ message = 'Memuat...' }: { message?: string }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.actionPrimaryAltBg} />
      <AppText variant="body" tone="secondary" align="center" style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

interface EmptyStateProps {
  message: string;
  hint?: string;
  icon?: IconName;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function EmptyState({
  message,
  hint,
  icon,
  actionLabel,
  onPressAction,
}: EmptyStateProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.emptyBox}>
      {icon ? (
        <View style={styles.iconTile}>
          <Ionicons name={icon} size={24} color={theme.colors.statusInfoFg} />
        </View>
      ) : null}
      <AppText variant="title" tone="primary" align="center">
        {message}
      </AppText>
      {hint ? (
        <AppText variant="body" tone="secondary" align="center" style={styles.text}>
          {hint}
        </AppText>
      ) : null}
      {actionLabel && onPressAction ? (
        <Button
          label={actionLabel}
          icon="arrow-forward"
          compact
          onPress={onPressAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({
  message = 'Data gagal dimuat. Periksa koneksi lalu coba lagi.',
  onRetry,
}: ErrorStateProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.emptyBox}>
      <View style={[styles.iconTile, styles.errorTile]}>
        <Ionicons name="cloud-offline-outline" size={24} color={theme.colors.statusDangerFg} />
      </View>
      <AppText variant="title" tone="primary" align="center">
        Gagal memuat
      </AppText>
      <AppText variant="body" tone="secondary" align="center" style={styles.text}>
        {message}
      </AppText>
      <Button
        label="Coba lagi"
        icon="refresh-outline"
        compact
        onPress={onRetry}
        style={styles.action}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  center: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.bgCanvas,
    paddingHorizontal: theme.spacing.xxl,
  },
  text: {
    marginTop: theme.spacing.sm,
  },
  emptyBox: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  iconTile: {
    width: theme.touchTarget.cta,
    height: theme.touchTarget.cta,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: theme.spacing.lg,
  },
  errorTile: {
    backgroundColor: theme.colors.statusDangerBg,
  },
  action: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.radii.pill,
  },
});
