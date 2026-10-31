import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius } from '@/constants/brand';
import { useMechanicAlerts } from '../mechanic-alerts';

interface NotificationBellProps {
  /** Warna ikon; pakai putih di atas header bergradasi. */
  tint?: string;
  /** Latar tombol; transparan di atas header bergradasi. */
  background?: string;
}

/** Lonceng notifikasi dengan badge jumlah yang belum dibaca. */
export function MechanicNotificationBell({
  tint = Brand.text,
  background = Brand.background,
}: NotificationBellProps) {
  const router = useRouter();
  const { unread } = useMechanicAlerts();
  const label =
    unread > 0 ? `Notifikasi, ${unread} belum dibaca` : 'Buka notifikasi';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => router.push('/(mechanic)/notifications')}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="notifications-outline" size={20} color={tint} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: Brand.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Brand.white, fontSize: 9, fontWeight: '700' },
});
