import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface HomeHeaderProps {
  name: string;
  unreadCount: number;
  gpsLabel: string;
  gpsActive: boolean;
  onPressLocation: () => void;
  onPressProfile: () => void;
  onPressNotifications: () => void;
  onPressSearch: () => void;
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
  if (!clean) return 'Pengguna';
  return clean.split(/\s+/)[0];
}

/**
 * Header Beranda client berkonsep Calm Utility (adaptif Light & Dark):
 * profil, strip status GPS pre-warmed, lonceng notifikasi, dan pintasan cari layanan.
 */
export function HomeHeader({
  name,
  unreadCount,
  gpsLabel,
  gpsActive,
  onPressLocation,
  onPressProfile,
  onPressNotifications,
  onPressSearch,
}: HomeHeaderProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const gpsTone = gpsActive ? theme.tones.success : theme.tones.neutral;

  return (
    <View style={[styles.header, { paddingTop: insets.top + theme.spacing.md }]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka profil"
          onPress={onPressProfile}
          style={({ pressed }) => [styles.userRow, pressed && styles.pressed]}
        >
          <Avatar name={name} size={44} />
          <View style={styles.userText}>
            <AppText variant="overline" tone="muted">
              CLIENT MONTIRGO
            </AppText>
            <AppText variant="h2" numberOfLines={1}>
              {greeting()}, {firstName(name)}
            </AppText>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Buka notifikasi'
          }
          hitSlop={8}
          onPress={onPressNotifications}
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        >
          <Ionicons name="notifications-outline" size={21} color={theme.colors.textPrimary} />
          {unreadCount > 0 ? (
            <View style={styles.bellBadge}>
              <AppText style={styles.bellBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Status GPS: ${gpsLabel}`}
        onPress={onPressLocation}
        style={({ pressed }) => [
          styles.gpsStrip,
          { backgroundColor: gpsTone.bg, borderColor: gpsTone.border },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name={gpsActive ? 'location' : 'locate-outline'}
          size={15}
          color={gpsTone.fg}
        />
        <AppText variant="caption" numberOfLines={1} style={[styles.gpsText, { color: gpsTone.fg }]}>
          {gpsLabel}
        </AppText>
        <Ionicons name="chevron-forward" size={14} color={gpsTone.fg} />
      </Pressable>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Cari layanan montir"
        onPress={onPressSearch}
        style={({ pressed }) => [styles.search, pressed && styles.pressed]}
      >
        <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
        <AppText variant="body" tone="muted" style={styles.searchText}>
          Cari masalah kendaraan atau layanan…
        </AppText>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
      </Pressable>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  header: {
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
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
    minHeight: theme.touchTarget.min,
  },
  userText: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  bell: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
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
    fontFamily: theme.fontFamily.bold,
    fontSize: 11,
    lineHeight: 13,
    color: theme.colors.textInverse,
  },
  gpsStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.sm,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
  },
  gpsText: {
    flex: 1,
    fontFamily: theme.fontFamily.medium,
  },
  search: {
    minHeight: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.input.borderCurve,
    backgroundColor: theme.colors.bgCanvas,
    borderWidth: 1,
    borderColor: theme.colors.borderDefault,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  searchText: {
    flex: 1,
  },
  pressed: { opacity: 0.78 },
});
