import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, Space, Type } from '@/constants/brand';

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
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          disabled={loading}
          onPress={onCancel}
          style={styles.backdrop}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Space.lg }]}>
          <View style={styles.grabber} />
          <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
            <Ionicons
              name={icon}
              size={22}
              color={destructive ? Brand.red : Brand.primary}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {children ? <View style={styles.extra}>{children}</View> : null}
          <Button
            label={confirmLabel}
            loading={loading}
            variant={destructive ? 'danger' : 'primary'}
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
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(6,11,22,0.55)',
  },
  sheet: {
    backgroundColor: Brand.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Space.xl,
    paddingTop: Space.sm,
    ...CardShadow,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.border,
    marginBottom: Space.lg,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDanger: { backgroundColor: Brand.redSoft },
  title: { ...Type.h2, color: Brand.text, marginTop: Space.md },
  message: { ...Type.body, color: Brand.textSecondary, marginTop: Space.sm, lineHeight: 21 },
  extra: { marginTop: Space.lg },
  confirm: { marginTop: Space.xl },
  cancel: { alignItems: 'center', paddingVertical: Space.md, marginTop: Space.xs },
  cancelText: { ...Type.bodyStrong, color: Brand.textSecondary },
  pressed: { opacity: 0.6 },
});
