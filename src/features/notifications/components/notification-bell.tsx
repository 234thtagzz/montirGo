import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { useMechanicAlerts } from '../mechanic-alerts';

interface NotificationBellProps {
  tint?: string;
  background?: string;
}

/** Lonceng notifikasi montir dengan badge jumlah yang belum dibaca. */
export function MechanicNotificationBell({ tint, background }: NotificationBellProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { unread } = useMechanicAlerts();
  const label = unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Buka notifikasi';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => router.push('/(mechanic)/notifications')}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background ?? theme.colors.bgSurfaceSubtle },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="notifications-outline"
        size={20}
        color={tint ?? theme.colors.textPrimary}
      />
      {unread > 0 ? (
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>{unread > 9 ? '9+' : unread}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) => ({
  button: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: { opacity: 0.75 },
  badge: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.statusDangerFg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  badgeText: {
    fontFamily: theme.fontFamily.bold,
    fontSize: 11,
    lineHeight: 13,
    color: theme.colors.textInverse,
  },
});
