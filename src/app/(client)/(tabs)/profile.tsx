import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { useAuth } from '@/features/auth/service';
import {
  getMyClientSummary,
  type ClientProfileSummary,
} from '@/features/client/service';
import { useSessionUser } from '@/hooks/use-session-user';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIdentityNumber, formatMonthYear } from '@/utils/format';

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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user, loading, refresh } = useSessionUser();
  const { logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [summary, setSummary] = useState<ClientProfileSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      getMyClientSummary()
        .then(setSummary)
        .catch(() => setSummary(null));
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

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { paddingTop: insets.top + theme.spacing.md }]}>
          <View style={styles.heroTop}>
            <AppText variant="overline" tone="muted">
              PROFIL CLIENT
            </AppText>
            <Badge label="Akun Client" tone="info" icon="person-outline" size="sm" />
          </View>

          <View style={styles.identity}>
            <Avatar name={name} uri={summary?.avatar_url} size={68} />
            <View style={styles.identityCopy}>
              <AppText variant="h1" numberOfLines={1}>
                {loading ? 'Memuat profil…' : name}
              </AppText>
              <AppText variant="body" tone="secondary" numberOfLines={1}>
                {user?.email ?? '-'}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buat permintaan montir"
            onPress={() =>
              router.push({
                pathname: '/(client)/request/new',
                params: { category: 'montir' },
              })
            }
            style={({ pressed }) => [styles.quickCard, theme.elevation.card, pressed && styles.pressed]}
          >
            <View style={styles.quickIcon}>
              <Ionicons name="flash" size={20} color={theme.colors.actionEmergencyFg} />
            </View>
            <View style={styles.flexCopy}>
              <AppText variant="title">Butuh bantuan montir?</AppText>
              <AppText variant="caption" tone="secondary">
                Buat permintaan dalam 3 ketukan, montir terdekat datang ke lokasimu.
              </AppText>
            </View>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.actionPrimaryAltBg} />
          </Pressable>

          <SectionHeading icon="color-palette-outline" title="Tampilan" />
          <Surface variant="default" padding="lg" style={styles.themeCard}>
            <AppText variant="label">Tema aplikasi</AppText>
            <AppText variant="caption" tone="secondary">
              Pilih mode terang, gelap untuk berkendara malam, atau ikuti pengaturan perangkat.
            </AppText>
            <ThemeSwitcher />
          </Surface>

          <SectionHeading icon="person-outline" title="Informasi pribadi" />
          <Surface variant="default" padding="none" style={styles.card}>
            <InfoRow label="Nama lengkap" value={user?.fullName || 'Belum diisi'} />
            <InfoRow label="Email" value={user?.email || 'Belum diisi'} />
            <InfoRow
              label="Nomor WhatsApp"
              value={user?.phoneNumber || 'Belum diisi'}
              muted={!user?.phoneNumber}
            />
            <InfoRow
              label="Nomor identitas (KTP)"
              value={formatIdentityNumber(user?.identityNumber) || 'Belum diisi'}
              muted={!user?.identityNumber}
              isLast
            />
          </Surface>

          <SectionHeading icon="analytics-outline" title="Ringkasan aktivitas" />
          <Surface variant="default" padding="none" style={styles.card}>
            <InfoRow
              label="Bergabung sejak"
              value={summary?.joined_at ? formatMonthYear(summary.joined_at) : 'Belum tersedia'}
              muted={!summary?.joined_at}
            />
            <InfoRow
              label="Total pesanan"
              value={summary ? String(summary.total_requests) : '-'}
            />
            <InfoRow
              label="Kendaraan tersimpan"
              value={summary ? String(summary.total_vehicles) : '-'}
              isLast
            />
          </Surface>

          <SectionHeading icon="grid-outline" title="Menu" />
          <Surface variant="default" padding="none" style={styles.card}>
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
                  <Ionicons name={item.icon} size={18} color={theme.colors.statusInfoFg} />
                </View>
                <View style={styles.flexCopy}>
                  <AppText variant="label">{item.label}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {item.description}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>
            ))}
          </Surface>

          <SectionHeading icon="help-circle-outline" title="Bantuan" />
          <Surface variant="default" padding="none" style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pusat bantuan"
              onPress={() => router.push('/(client)/services')}
              style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="help-circle-outline" size={18} color={theme.colors.statusInfoFg} />
              </View>
              <View style={styles.flexCopy}>
                <AppText variant="label">Pusat Bantuan</AppText>
                <AppText variant="caption" tone="secondary">
                  Daftar layanan dan panduan MontirGo
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </Pressable>
            <View style={[styles.menuRow, styles.menuRowLast]}>
              <View style={styles.menuIcon}>
                <Ionicons name="mail-outline" size={18} color={theme.colors.statusInfoFg} />
              </View>
              <View style={styles.flexCopy}>
                <AppText variant="label">Email dukungan</AppText>
                <AppText variant="caption" tone="secondary">
                  support@montirgo.id
                </AppText>
              </View>
            </View>
          </Surface>

          <Button
            label="Keluar dari akun"
            variant="dangerSubtle"
            icon="log-out-outline"
            onPress={() => setLogoutVisible(true)}
            style={styles.logout}
          />

          <AppText variant="caption" tone="muted" style={styles.footer}>
            MontirGo · Layanan montir panggilan
          </AppText>
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
        onConfirm={() => void doLogout()}
        onCancel={() => (loggingOut ? undefined : setLogoutVisible(false))}
      />
    </View>
  );
}

function SectionHeading({ icon, title }: { icon: IconName; title: string }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={15} color={theme.colors.statusInfoFg} />
      </View>
      <AppText variant="title">{title}</AppText>
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
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.infoRow, isLast && styles.menuRowLast]}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong" tone={muted ? 'muted' : 'primary'}>
        {value}
      </AppText>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bgCanvas,
  },
  content: {
    paddingBottom: theme.spacing.xxxl,
  },
  hero: {
    backgroundColor: theme.colors.bgSurface,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: theme.spacing.lg,
  },
  heroTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  identity: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  identityCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  body: {
    paddingHorizontal: theme.spacing.screenPadding,
  },
  quickCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.bgSurface,
    borderRadius: theme.radii.lg,
    borderCurve: theme.components.card.borderCurve,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.actionEmergencyBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  flexCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  themeCard: {
    gap: theme.spacing.sm,
  },
  card: {
    overflow: 'hidden' as const,
  },
  infoRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    gap: theme.spacing.xxs,
  },
  menuRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
    minHeight: 62,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  logout: {
    marginTop: theme.spacing.xl,
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: theme.spacing.xl,
  },
  pressed: { opacity: 0.78 },
});
