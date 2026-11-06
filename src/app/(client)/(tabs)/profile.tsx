import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Gradient, Radius, ScreenPadding, Space, Type } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
import { useAuth } from '@/features/auth/service';

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: IconName;
  route:
    | '/(client)/(tabs)/my-requests'
    | '/(client)/(tabs)/my-vehicles'
    | '/(client)/notifications';
}

const MENU: MenuItem[] = [
  {
    key: 'orders',
    label: 'Pesanan Saya',
    description: 'Riwayat dan status permintaan bantuan',
    icon: 'receipt-outline',
    route: '/(client)/(tabs)/my-requests',
  },
  {
    key: 'vehicles',
    label: 'Garasi Saya',
    description: 'Kendaraan yang tersimpan',
    icon: 'car-outline',
    route: '/(client)/(tabs)/my-vehicles',
  },
  {
    key: 'notifications',
    label: 'Notifikasi',
    description: 'Info terbaru seputar pesanan',
    icon: 'notifications-outline',
    route: '/(client)/notifications',
  },
];

export default function ClientProfileScreen() {
  const { user, loading, refresh } = useSessionUser();
  const { logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Profil bisa terisi setelah pendaftaran; segarkan setiap kali tab dibuka.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch {
      setLoggingOut(false);
    }
  };

  const name = user?.fullName || 'Pengguna MontirGo';
  const initials = name;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={[styles.statusBackdrop, { height: insets.top }]} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={Gradient.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Space.md }]}
        >
          <Text style={styles.heroEyebrow}>AKUN CLIENT</Text>

          <View style={styles.identity}>
            <View style={styles.avatarRing}>
              <Avatar name={initials} size={62} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.name} numberOfLines={1}>
                {loading ? 'Memuat profil…' : name}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user?.email ?? '-'}
              </Text>
              <View style={styles.roleBadge}>
                <Ionicons name="person-outline" size={11} color={Brand.volt} />
                <Text style={styles.roleText}>Akun client</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>INFORMASI PRIBADI</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Nama lengkap" value={user?.fullName || 'Belum diisi'} />
            <InfoRow label="Email" value={user?.email || 'Belum diisi'} />
            <InfoRow
              label="Nomor WhatsApp"
              value={user?.phoneNumber || 'Belum diisi'}
              muted={!user?.phoneNumber}
              isLast
            />
          </View>

          <Text style={styles.sectionLabel}>MENU</Text>
          <View style={styles.menuCard}>
            {MENU.map((item, index) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => router.push(item.route)}
                style={({ pressed }) => [
                  styles.menuRow,
                  index === MENU.length - 1 && styles.menuRowLast,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon} size={18} color={Brand.primary} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuDescription}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Brand.textMuted} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>BANTUAN</Text>
          <View style={styles.menuCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pusat bantuan"
              onPress={() => router.push('/(client)/services')}
              style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="help-circle-outline" size={18} color={Brand.primary} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuLabel}>Pusat Bantuan</Text>
                <Text style={styles.menuDescription}>Pertanyaan seputar layanan MontirGo</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Brand.textMuted} />
            </Pressable>
            <View style={[styles.menuRow, styles.menuRowLast]}>
              <View style={styles.menuIcon}>
                <Ionicons name="mail-outline" size={18} color={Brand.primary} />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuLabel}>Email dukungan</Text>
                <Text style={styles.menuDescription}>support@montirgo.id</Text>
              </View>
            </View>
          </View>

          <Button
            label="Keluar dari akun"
            variant="secondary"
            icon="log-out-outline"
            onPress={() => setLogoutVisible(true)}
            style={styles.logout}
          />

          <Text style={styles.footer}>MontirGo · Layanan montir panggilan</Text>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={logoutVisible}
        loading={loggingOut}
        destructive
        icon="log-out-outline"
        title="Keluar dari akun?"
        message="Kamu perlu login kembali untuk memesan montir."
        confirmLabel="Keluar"
        onConfirm={doLogout}
        onCancel={() => (loggingOut ? undefined : setLogoutVisible(false))}
      />
    </View>
  );
}

function InfoRow({
  label,
  value,
  isLast,
  muted,
}: {
  label: string;
  value: string;
  isLast?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, muted && styles.infoValueMuted]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  statusBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Gradient.header[0],
    zIndex: 2,
  },
  content: { paddingBottom: Space.xxxl },
  hero: {
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.xxl,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
  },
  heroEyebrow: { ...Type.micro, color: Brand.inkMuted, letterSpacing: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Space.lg, marginTop: Space.lg },
  avatarRing: {
    padding: 2,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  identityCopy: { flex: 1 },
  name: { ...Type.h1, color: Brand.white },
  email: { ...Type.meta, color: Brand.inkText, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.09)',
    marginTop: Space.sm,
  },
  roleText: { fontSize: 10, fontWeight: '700', color: Brand.inkText },
  body: { paddingHorizontal: ScreenPadding },
  sectionLabel: {
    ...Type.micro,
    color: Brand.textMuted,
    marginTop: Space.xl,
    marginBottom: Space.sm,
  },
  infoCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  infoRow: {
    paddingVertical: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: 11, color: Brand.textMuted, fontWeight: '600' },
  infoValue: { ...Type.bodyStrong, fontSize: 13.5, color: Brand.text, marginTop: 3 },
  infoValueMuted: { color: Brand.textMuted, fontWeight: '400' },
  menuCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.divider,
    minHeight: 62,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1 },
  menuLabel: { ...Type.bodyStrong, color: Brand.text },
  menuDescription: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  logout: { marginTop: Space.xxl },
  footer: {
    ...Type.meta,
    color: Brand.textMuted,
    textAlign: 'center',
    marginTop: Space.xl,
  },
  pressed: { opacity: 0.7 },
});
