import { ActivityIndicator, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import type { CalloutFeeTier } from '@/features/client/types';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatIDR } from '@/utils/format';

const TIER_LABEL: Record<CalloutFeeTier, string> = {
  motor: 'Tier Motor',
  mobil: 'Tier Mobil',
  derek: 'Tier Derek / Towing',
};

interface CalloutFeeCtaCardProps {
  tier: CalloutFeeTier;
  calloutAmount: number;
  submitting: boolean;
  onSubmit: () => void;
}

/**
 * Ringkasan Biaya Panggil Pasti + tombol utama 56px di dasar form 3-Tap.
 */
export function CalloutFeeCtaCard({
  tier,
  calloutAmount,
  submitting,
  onSubmit,
}: CalloutFeeCtaCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Surface variant="default" padding="lg" style={styles.card}>
      <View style={styles.feeRow}>
        <View style={styles.feeCopy}>
          <AppText variant="overline" tone="muted">
            BIAYA PANGGIL PASTI
          </AppText>
          <AppText variant="h1" style={theme.tabularNums}>
            {formatIDR(calloutAmount)}
          </AppText>
        </View>
        <Badge label={TIER_LABEL[tier]} tone="info" size="sm" />
      </View>

      <AppText variant="caption" tone="secondary">
        Biaya panggil sudah tetap dan termasuk di tagihan akhir. Estimasi perbaikan/suku cadang wajib kamu setujui dulu di lokasi sebelum dikerjakan.
      </AppText>

      {submitting ? (
        <View style={styles.analyzingRow}>
          <ActivityIndicator size="small" color={theme.colors.statusInfoFg} />
          <AppText variant="caption" tone="info">
            Mengirim permintaan & menyiapkan diagnosa awal…
          </AppText>
        </View>
      ) : null}

      <Button
        label="Kirim Permintaan"
        icon="paper-plane-outline"
        variant="emergency"
        size="cta"
        loading={submitting}
        onPress={onSubmit}
      />
    </Surface>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    gap: theme.spacing.md,
    borderColor: theme.colors.borderDefault,
  },
  feeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  feeCopy: {
    gap: theme.spacing.xxs,
  },
  analyzingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusInfoBg,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
});
