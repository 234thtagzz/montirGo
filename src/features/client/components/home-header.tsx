import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Gradient, Radius, ScreenPadding, Space, Type } from '@/constants/brand';

interface HomeHeaderProps {
  name: string;
  unreadCount: number;
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
 * Header Beranda client — struktur yang sama dengan DashboardHeader montir:
 * eyebrow brand, sapaan + nama, lonceng berbadge, lalu chip status.
 * Kolom pencarian tetap ada karena merupakan fitur utama sisi client.
 */
export function HomeHeader({
  name,
  unreadCount,
  onPressProfile,
  onPressNotifications,
  onPressSearch,
}: HomeHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={Gradient.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.9 }}
      style={[styles.header, { paddingTop: insets.top + Space.md }]}
    >
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka profil"
          onPress={onPressProfile}
          style={({ pressed }) => [styles.userRow, pressed && styles.pressed]}
        >
          <View style={styles.avatarRing}>
            <Avatar name={name} size={42} />
          </View>
          <View style={styles.userText}>
            <Text style={styles.eyebrow}>CLIENT MONTIRGO</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting()}, {firstName(name)}
            </Text>
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
          <Ionicons name="notifications-outline" size={20} color={Brand.white} />
          {unreadCount > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.roleChip}>
          <Ionicons name="person-outline" size={13} color={Brand.volt} />
          <Text style={styles.roleText}>Akun client</Text>
        </View>
        <View style={styles.modeChip}>
          <View style={styles.modeDot} />
          <Text style={styles.modeText}>Siap memesan</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Cari layanan montir"
        onPress={onPressSearch}
        style={({ pressed }) => [styles.search, pressed && styles.searchPressed]}
      >
        <Ionicons name="search-outline" size={18} color={Brand.inkMuted} />
        <Text style={styles.searchText}>Cari layanan montir…</Text>
        <Ionicons name="chevron-forward" size={16} color={Brand.inkMuted} />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: ScreenPadding,
    paddingBottom: 58,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarRing: {
    padding: 2,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  userText: { flex: 1 },
  eyebrow: { ...Type.micro, color: Brand.inkMuted, letterSpacing: 1.2 },
  greeting: { ...Type.title, color: Brand.white, marginTop: 3 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pressed: { opacity: 0.7 },
  bellBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: Brand.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Brand.ink,
  },
  bellBadgeText: { color: Brand.white, fontSize: 8.5, fontWeight: '800' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.xl,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(201,241,88,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,241,88,0.2)',
  },
  roleText: { ...Type.micro, color: Brand.inkText, fontWeight: '600', letterSpacing: 0.1 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.volt },
  modeText: { ...Type.meta, color: Brand.inkMuted },
  search: {
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    gap: Space.sm,
    marginTop: Space.lg,
  },
  searchPressed: { opacity: 0.92 },
  searchText: { flex: 1, color: Brand.inkMuted, fontSize: 13.5 },
});
