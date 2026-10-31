import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Gradient, Radius, ScreenPadding, Space } from '@/constants/brand';

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
  if (hour < 11) return 'Selamat pagi,';
  if (hour < 15) return 'Selamat siang,';
  if (hour < 18) return 'Selamat sore,';
  return 'Selamat malam,';
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
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + Space.md }]}
    >
      <View style={styles.topRow}>
        <View style={styles.userRow}>
          <View style={styles.avatarRing}>
            <Avatar name={name} size={40} />
          </View>
          <View style={styles.userText}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {firstName(name)}
            </Text>
          </View>
        </View>

        <View style={styles.topActions}>
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

          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? Brand.green : 'rgba(255,255,255,0.6)' },
              ]}
            />
            <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.prompt}>Kelola order & penghasilanmu</Text>

      <View style={[styles.verify, isVerified ? styles.verifyOk : styles.verifyPending]}>
        <Ionicons
          name={isVerified ? 'shield-checkmark' : 'alert-circle-outline'}
          size={13}
          color={Brand.white}
        />
        <Text style={styles.verifyText}>
          {isVerified
            ? 'Akun terverifikasi admin'
            : 'Belum terverifikasi — kamu tetap bisa menerima order'}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: ScreenPadding,
    paddingBottom: 64,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm },
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
  topActions: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  bell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pressed: { opacity: 0.7 },
  bellBadge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: Brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: Brand.white, fontSize: 9, fontWeight: '700' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Space.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: Brand.white, fontSize: 12, fontWeight: '700' },
  prompt: {
    color: Brand.white,
    fontSize: 21,
    fontWeight: '700',
    marginTop: Space.lg,
    letterSpacing: -0.2,
  },
  verify: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: Space.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    marginTop: Space.md,
  },
  verifyOk: { backgroundColor: 'rgba(255,255,255,0.18)' },
  verifyPending: { backgroundColor: 'rgba(255,196,49,0.28)' },
  verifyText: { color: Brand.white, fontSize: 11, fontWeight: '600' },
});
