import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';
import { useAuth } from '@/features/auth/service';

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: IconName;
  route?: '/(client)/my-requests' | '/(client)/my-vehicles' | '/(client)/notifications';
}

const MENU: MenuItem[] = [
  {
    key: 'orders',
    label: 'Pesanan Saya',
    description: 'Riwayat dan status permintaan bantuan',
    icon: 'receipt-outline',
    route: '/(client)/my-requests',
  },
  {
    key: 'vehicles',
    label: 'Garasi Saya',
    description: 'Kendaraan yang tersimpan',
    icon: 'car-outline',
    route: '/(client)/my-vehicles',
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
  const { user, loading } = useSessionUser();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Keluar dari akun?', 'Kamu perlu login kembali untuk memesan montir.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/(auth)/login');
          } catch (error) {
            Alert.alert('Gagal', error instanceof Error ? error.message : 'Gagal keluar.');
          }
        },
      },
    ]);
  };

  const name = user?.fullName || 'Pengguna MontirGo';

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profil" showBack={false} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Avatar name={name} size={60} />
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={1}>
              {loading ? 'Memuat profil…' : name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email ?? '-'}
            </Text>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color={Brand.green} />
              <Text style={styles.roleText}>Akun Client</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Nama lengkap" value={user?.fullName || '-'} />
          <InfoRow label="Email" value={user?.email || '-'} />
          <InfoRow label="Nomor telepon" value={user?.phoneNumber || 'Belum diisi'} isLast />
        </View>

        <Text style={styles.section}>Menu</Text>
        <View style={styles.menuCard}>
          {MENU.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => (item.route ? router.push(item.route) : undefined)}
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

        <Text style={styles.section}>Bantuan</Text>
        <View style={styles.menuCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kirim masukan lewat email"
            onPress={() =>
              Alert.alert(
                'Bantuan',
                'Tim MontirGo dapat dihubungi lewat email support@montirgo.id.',
              )
            }
            style={({ pressed }) => [styles.menuRow, styles.menuRowLast, pressed && styles.pressed]}
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
        </View>

        <Button
          label="Keluar"
          variant="danger"
          icon="log-out-outline"
          onPress={handleLogout}
          style={styles.logout}
        />
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.background },
  content: { padding: ScreenPadding, paddingBottom: Space.xxxl },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  identityCopy: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', color: Brand.text },
  email: { fontSize: 12, color: Brand.textSecondary, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Brand.greenSoft,
    marginTop: Space.sm,
  },
  roleText: { fontSize: 10.5, fontWeight: '700', color: Brand.green },
  infoCard: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Space.lg,
    marginTop: Space.md,
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
  infoValue: { fontSize: 13, color: Brand.text, marginTop: 3 },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    marginTop: Space.xxl,
    marginBottom: Space.md,
  },
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
  menuLabel: { fontSize: 13.5, fontWeight: '600', color: Brand.text },
  menuDescription: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  logout: { marginTop: Space.xxl },
  pressed: { opacity: 0.7 },
});
