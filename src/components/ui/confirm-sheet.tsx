import type { ComponentProps, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  onConfirm: () => void;
  onCancel: () => void;
  /** Baris ringkasan tambahan di atas tombol. */
  children?: ReactNode;
}

/**
 * Konfirmasi bawah (bottom sheet) untuk aksi finansial & status.
 * Lebih mudah dijangkau ibu jari dibanding Alert di tengah layar.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  loading = false,
  destructive = false,
  icon = 'shield-checkmark-outline',
  onConfirm,
  onCancel,
  children,
}: ConfirmSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <BottomSheet
      visible={visible}
      dismissible={!loading}
      onClose={onCancel}
    >
      <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
        <Ionicons
          name={icon}
          size={22}
          color={destructive ? theme.colors.statusDangerFg : theme.colors.statusInfoFg}
        />
      </View>
      <AppText variant="h2" tone="primary" style={styles.title}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" tone="secondary" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {children ? <View style={styles.extra}>{children}</View> : null}
      <Button
        label={confirmLabel}
        loading={loading}
        variant={destructive ? 'danger' : 'primary'}
        size="cta"
        onPress={onConfirm}
        style={styles.confirm}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        disabled={loading}
        onPress={onCancel}
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
      >
        <AppText variant="bodyStrong" tone="secondary">
          {cancelLabel}
        </AppText>
      </Pressable>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => ({
  iconWrap: {
    width: theme.touchTarget.min,
    height: theme.touchTarget.min,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconWrapDanger: {
    backgroundColor: theme.colors.statusDangerBg,
  },
  title: {
    marginTop: theme.spacing.xs,
  },
  message: {
    marginTop: theme.spacing.xs,
  },
  extra: {
    marginTop: theme.spacing.md,
  },
  confirm: {
    marginTop: theme.spacing.lg,
  },
  cancel: {
    minHeight: theme.touchTarget.min,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: 0.65,
  },
});
