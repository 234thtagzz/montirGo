import { View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

interface HeroCardProps {
  startingCalloutFee: number;
  onPressRequest: () => void;
  onPressOrders: () => void;
}

/**
 * Kartu aksi utama Beranda Client: 1 CTA darurat 56px + transparansi Biaya Panggil Pasti.
 */
export function HeroCard({
  startingCalloutFee,
  onPressRequest,
  onPressOrders,
}: HeroCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Surface variant="default" padding="lg" style={styles.card}>
      <View style={styles.top}>
        <View style={styles.iconTile}>
          <Ionicons name="flash" size={22} color={theme.colors.statusEmergencyFg} />
        </View>
        <View style={styles.copy}>
          <Badge label="SIAP DIPANGGIL" tone="emergency" size="sm" />
          <AppText variant="h2" style={styles.title}>
            Kendaraan bermasalah?
          </AppText>
          <AppText variant="body" tone="secondary">
            Montir terdekat datang langsung ke lokasimu dalam hitungan menit.
          </AppText>
        </View>
      </View>

      <View style={styles.feeStrip}>
        <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.statusInfoFg} />
        <AppText variant="caption" tone="info" style={[styles.feeText, theme.tabularNums]}>
          Biaya panggil pasti mulai {formatIDR(startingCalloutFee)} · estimasi perbaikan disetujui dulu di lokasi
        </AppText>
      </View>

      <View style={styles.actions}>
        <Button
          label="Panggil Montir Sekarang"
          icon="flash-outline"
          variant="emergency"
          size="cta"
          onPress={onPressRequest}
          style={styles.primary}
        />
        <Button
          label="Riwayat Pesanan"
          icon="receipt-outline"
          variant="secondary"
          size="md"
          onPress={onPressOrders}
        />
      </View>
    </Surface>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  top: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.statusEmergencyBg,
    borderWidth: 1,
    borderColor: theme.colors.statusEmergencyBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  title: {
    marginTop: theme.spacing.xxs,
  },
  feeStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusInfoBg,
    borderWidth: 1,
    borderColor: theme.colors.statusInfoBorder,
    borderRadius: theme.radii.sm,
    borderCurve: theme.components.card.borderCurve,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  feeText: {
    flex: 1,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  primary: {
    width: '100%' as const,
  },
});
