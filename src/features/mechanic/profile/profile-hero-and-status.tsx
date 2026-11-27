import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { OnlineCard } from '@/features/mechanic/components/online-card';
import type { MechanicProfile } from '@/features/mechanic/service';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface ProfileHeroAndStatusProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  profile: MechanicProfile | null;
  online: boolean;
  uploadingAvatar: boolean;
  onPickAvatar: () => void;
  onToggleOnline: (value: boolean) => void;
}

export function ProfileHeroAndStatus({
  name,
  email,
  avatarUrl,
  profile,
  online,
  uploadingAvatar,
  onPickAvatar,
  onToggleOnline,
}: ProfileHeroAndStatusProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const verified = profile?.is_verified ?? false;
  const rating = Number(profile?.rating_avg ?? 0);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + theme.spacing.md }]}>
      <Surface variant="elevated" padding="lg" style={styles.heroCard}>
        <View style={styles.heroTop}>
          <AppText variant="overline" tone="muted">
            PROFIL MONTIR
          </AppText>
          <Badge
            size="sm"
            tone={verified ? 'success' : 'warning'}
            icon={verified ? 'shield-checkmark-outline' : 'alert-circle-outline'}
            label={verified ? 'Terverifikasi' : 'Belum verifikasi'}
          />
        </View>

        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ganti foto profil"
            disabled={uploadingAvatar}
            onPress={onPickAvatar}
            style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
          >
            <Avatar name={name} uri={avatarUrl} size={72} />
            <View style={styles.avatarEdit}>
              <Ionicons
                name={uploadingAvatar ? 'hourglass-outline' : 'camera'}
                size={14}
                color={theme.colors.actionPrimaryFg}
              />
            </View>
          </Pressable>

          <View style={styles.identityCopy}>
            <AppText variant="h2" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              {email}
            </AppText>
            <Badge
              size="sm"
              tone="info"
              icon="construct-outline"
              label="Akun Montir"
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat
            icon="star"
            iconColor={theme.colors.statusWarningFg}
            value={rating.toFixed(1)}
            label="Rating"
          />
          <Stat
            icon="chatbubble-ellipses-outline"
            iconColor={theme.colors.statusInfoFg}
            value={(profile?.rating_count ?? 0).toString()}
            label="Ulasan"
          />
          <Stat
            icon="checkmark-done-outline"
            iconColor={theme.colors.statusSuccessFg}
            value={(profile?.total_jobs ?? 0).toString()}
            label="Job selesai"
          />
        </View>
      </Surface>

      <OnlineCard online={online} onToggle={onToggleOnline} />

      <Surface variant="default" padding="lg">
        <ThemeSwitcher />
      </Surface>
    </View>
  );
}

function Stat({
  icon,
  iconColor,
  value,
  label,
}: {
  icon: IconName;
  iconColor: string;
  value: string;
  label: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <AppText variant="title" tabular>
        {value}
      </AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    paddingHorizontal: theme.spacing.screenPadding,
    gap: theme.spacing.md,
  },
  heroCard: {
    gap: theme.spacing.md,
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  identity: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  avatarWrap: {
    position: 'relative' as const,
  },
  avatarEdit: {
    position: 'absolute' as const,
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.actionPrimaryBg,
    borderWidth: 2,
    borderColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  identityCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 2,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: {
    opacity: 0.78,
  },
});
