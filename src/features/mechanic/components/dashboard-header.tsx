import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface DashboardHeaderProps {
  name: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  isVerified: boolean;
  /** Jumlah notifikasi yang belum dibaca (badge lonceng). */
  unreadNotifications?: number;
  onPressNotifications?: () => void;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function firstName(name: string): string {
  const clean = name.trim();
  if (!clean) return 'Montir';
  return clean.split(/\s+/)[0];
}

export function DashboardHeader({
  name,
  avatarUrl,
  isOnline,
  isVerified,
  unreadNotifications = 0,
  onPressNotifications,
}: DashboardHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
      <View style={styles.topRow}>
        <View style={styles.userRow}>
          <Avatar name={name} uri={avatarUrl} size={44} />
          <View style={styles.userText}>
            <AppText variant="overline" tone="muted">
              MONTIR MONTIRGO
            </AppText>
            <AppText variant="title" numberOfLines={1}>
              {greeting()}, {firstName(name)}
            </AppText>
          </View>
        </View>

        {onPressNotifications ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadNotifications > 0
                ? `Notifikasi, ${unreadNotifications} belum dibaca`
                : 'Buka notifikasi'
            }
            hitSlop={8}
            onPress={onPressNotifications}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={theme.colors.textPrimary}
            />
            {unreadNotifications > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <Surface variant="subtle" padding="sm" radius="md" style={styles.metaBar}>
        <View style={styles.metaRow}>
          <Badge
            size="sm"
            tone={isVerified ? 'success' : 'warning'}
            icon={isVerified ? 'shield-checkmark-outline' : 'alert-circle-outline'}
            label={isVerified ? 'Terverifikasi' : 'Belum verifikasi'}
          />
          <Badge
            size="sm"
            dot
            tone={isOnline ? 'success' : 'neutral'}
            label={isOnline ? 'Mode Siaga' : 'Offline'}
          />
        </View>
      </Surface>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  header: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bgCanvas,
    gap: theme.spacing.md,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  userRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    flex: 1,
  },
  userText: {
    flex: 1,
    gap: 2,
  },
  bell: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.bgSurface,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
  },
  pressed: {
    opacity: 0.72,
  },
  bellBadge: {
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
  bellBadgeText: {
    color: theme.colors.textInverse,
    fontFamily: theme.fontFamily.bold,
    fontSize: 11,
    lineHeight: 13,
  },
  metaBar: {
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
});
