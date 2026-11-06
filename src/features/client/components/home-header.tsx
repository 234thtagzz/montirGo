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
  if (hour < 11) return 'Selamat pagi,';
  if (hour < 15) return 'Selamat siang,';
  if (hour < 18) return 'Selamat sore,';
  return 'Selamat malam,';
}

function firstName(name: string): string {
  const clean = name.trim();
  if (!clean) return 'Pengguna';
  return clean.split(/\s+/)[0];
}

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
      end={{ x: 1, y: 1 }}
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
            <Avatar name={name} size={38} />
          </View>
          <View style={styles.userText}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {firstName(name)}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'
          }
          hitSlop={8}
          onPress={onPressNotifications}
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        >
          <Ionicons name="notifications-outline" size={21} color={Brand.white} />
          {unreadCount > 0 ? <View style={styles.badge} /> : null}
        </Pressable>
      </View>

      <Text style={styles.prompt}>Mau bantuan apa hari ini?</Text>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Cari layanan montir"
        onPress={onPressSearch}
        style={({ pressed }) => [styles.search, pressed && styles.searchPressed]}
      >
        <Ionicons name="search-outline" size={18} color={Brand.textSecondary} />
        <Text style={styles.searchText}>Cari layanan montir…</Text>
        <Ionicons name="chevron-forward" size={16} color={Brand.textMuted} />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: ScreenPadding,
    paddingBottom: 64,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatarRing: {
    padding: 2,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  userText: { flex: 1 },
  greeting: { color: 'rgba(255,255,255,0.78)', fontSize: 12 },
  name: { color: Brand.white, fontSize: 16, fontWeight: '700', marginTop: 1 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.volt,
    borderWidth: 1.5,
    borderColor: Brand.ink,
  },
  prompt: {
    ...Type.h1,
    color: Brand.white,
    marginTop: Space.lg,
    marginBottom: Space.md,
  },
  search: {
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Brand.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    gap: Space.sm,
  },
  searchPressed: { opacity: 0.92 },
  searchText: { flex: 1, color: Brand.textSecondary, fontSize: 14 },
  pressed: { opacity: 0.75 },
});
