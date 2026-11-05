import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand, Radius, Space, Type } from '@/constants/brand';
import { Ionicons, type IconName } from '@/components/ui/icon';

export function LoadingState({ message = 'Memuat...' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={Brand.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

interface EmptyStateProps {
  message: string;
  hint?: string;
  icon?: IconName;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function EmptyState({ message, hint, icon, actionLabel, onPressAction }: EmptyStateProps) {
  return (
    <View style={styles.emptyBox}>
      {icon ? (
        <View style={styles.iconTile}>
          <Ionicons name={icon} size={24} color={Brand.primary} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{message}</Text>
      {hint ? <Text style={styles.text}>{hint}</Text> : null}
      {actionLabel && onPressAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPressAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={Brand.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({
  message = 'Data gagal dimuat. Periksa koneksi lalu coba lagi.',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.emptyBox}>
      <View style={[styles.iconTile, styles.errorTile]}>
        <Ionicons name="cloud-offline-outline" size={24} color={Brand.red} />
      </View>
      <Text style={styles.emptyTitle}>Gagal memuat</Text>
      <Text style={styles.text}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Ionicons name="refresh-outline" size={15} color={Brand.white} />
        <Text style={styles.actionText}>Coba lagi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.background,
    paddingHorizontal: Space.xxl,
  },
  text: {
    ...Type.body,
    color: Brand.textSecondary,
    marginTop: Space.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.xxl,
    paddingHorizontal: Space.lg,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.lg,
  },
  errorTile: { backgroundColor: Brand.redSoft },
  emptyTitle: { ...Type.title, color: Brand.text, textAlign: 'center' },
  action: {
    marginTop: Space.lg,
    minHeight: 42,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.pill,
    backgroundColor: Brand.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { ...Type.label, color: Brand.white, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
