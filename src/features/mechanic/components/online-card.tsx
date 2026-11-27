import { Pressable, Switch, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Ionicons } from '@/components/ui/icon';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface OnlineCardProps {
  online: boolean;
  onToggle: (value: boolean) => void;
}

/**
 * Kartu saklar SIAGA / OFFLINE utama di Beranda Montir.
 * Area tekan besar (>= 48px) untuk penggunaan cepat di lapangan.
 */
export function OnlineCard({ online, onToggle }: OnlineCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const activeTone = online ? theme.tones.success : theme.tones.neutral;

  return (
    <Surface
      variant="elevated"
      padding="lg"
      style={[
        styles.card,
        {
          borderColor: online
            ? theme.colors.statusSuccessBorder
            : theme.colors.borderDefault,
        },
      ]}
    >
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: online }}
        accessibilityLabel="Status menerima order"
        onPress={() => onToggle(!online)}
        style={({ pressed }) => [styles.top, pressed && styles.pressed]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: activeTone.bg,
              borderColor: activeTone.border,
            },
          ]}
        >
          <Ionicons name="power" size={22} color={activeTone.fg} />
        </View>

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <AppText variant="title">
              {online ? 'SIAGA TERIMA ORDER' : 'OFFLINE'}
            </AppText>
            <Badge
              size="sm"
              dot={online}
              tone={online ? 'success' : 'neutral'}
              label={online ? 'SIAGA' : 'ISTIRAHAT'}
            />
          </View>
          <AppText variant="caption" tone="secondary" style={styles.subtitle}>
            {online
              ? 'Request darurat terdekat akan masuk otomatis.'
              : 'Aktifkan saklar untuk mulai menerima order.'}
          </AppText>
        </View>

        <Switch
          value={online}
          onValueChange={onToggle}
          trackColor={{
            false: theme.colors.borderInput,
            true: theme.colors.statusSuccessFg,
          }}
          thumbColor={theme.colors.bgSurface}
          ios_backgroundColor={theme.colors.borderInput}
          accessibilityLabel="Saklar siaga montir"
        />
      </Pressable>

      <View style={styles.footer}>
        <View style={[styles.statusDot, { backgroundColor: activeTone.fg }]} />
        <AppText variant="caption" tone="secondary" style={styles.footerText}>
          {online
            ? 'Tersinkron ke radar MontirGo secara realtime'
            : 'Kamu tidak muncul dalam pencarian client'}
        </AppText>
      </View>
    </Surface>
  );
}

const createStyles = (theme: AppTheme) => ({
  card: {
    borderWidth: 1.5,
  },
  top: {
    minHeight: theme.touchTarget.cta,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  iconCircle: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  subtitle: {
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  footerText: {
    flex: 1,
  },
});
