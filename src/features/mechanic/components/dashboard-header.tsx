import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Gradient, Radius, ScreenPadding, Space, Type } from '@/constants/brand';

interface DashboardHeaderProps {
  name: string;
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
  isOnline,
  isVerified,
  unreadNotifications = 0,
  onPressNotifications,
}: DashboardHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={Gradient.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.9 }}
      style={[styles.header, { paddingTop: insets.top + Space.md }]}
    >
      <View style={styles.topRow}>
        <View style={styles.userRow}>
          <View style={styles.avatarRing}>
            <Avatar name={name} size={42} />
          </View>
          <View style={styles.userText}>
            <Text style={styles.eyebrow}>MONTIR MONTIRGO</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting()}, {firstName(name)}
            </Text>
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
            <Ionicons name="notifications-outline" size={20} color={Brand.white} />
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

      <View style={styles.metaRow}>
        <View style={[styles.verify, !isVerified && styles.verifyPending]}>
          <Ionicons
            name={isVerified ? 'shield-checkmark' : 'alert-circle-outline'}
            size={13}
            color={isVerified ? Brand.volt : '#FCD34D'}
          />
          <Text style={styles.verifyText}>
            {isVerified ? 'Akun terverifikasi' : 'Belum terverifikasi'}
          </Text>
        </View>
        <View style={styles.modeChip}>
          <View style={[styles.modeDot, { backgroundColor: isOnline ? Brand.volt : '#5D6A83' }]} />
          <Text style={styles.modeText}>{isOnline ? 'Siap bekerja' : 'Sedang istirahat'}</Text>
        </View>
      </View>
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
  verify: {
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
  verifyPending: {
    backgroundColor: 'rgba(252,211,77,0.1)',
    borderColor: 'rgba(252,211,77,0.22)',
  },
  verifyText: { ...Type.micro, color: Brand.inkText, fontWeight: '600', letterSpacing: 0.1 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modeDot: { width: 6, height: 6, borderRadius: 3 },
  modeText: { ...Type.meta, color: Brand.inkMuted },
});
