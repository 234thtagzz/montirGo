import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand, Radius, Space } from '@/constants/brand';
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
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={22} color={Brand.primary} />
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
      <View style={[styles.iconCircle, styles.errorCircle]}>
        <Ionicons name="cloud-offline-outline" size={22} color={Brand.red} />
      </View>
      <Text style={styles.emptyTitle}>Gagal memuat</Text>
      <Text style={styles.text}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Ionicons name="refresh-outline" size={15} color={Brand.white} />
        <Text style={[styles.actionText, { color: Brand.white }]}>Coba lagi</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.surface,
    paddingHorizontal: Space.xxl,
  },
  text: { fontSize: 13, color: Brand.textSecondary, marginTop: Space.sm, textAlign: 'center' },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.xxl,
    paddingHorizontal: Space.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.md,
  },
  errorCircle: { backgroundColor: Brand.redSoft },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: Brand.text, textAlign: 'center' },
  action: {
    marginTop: Space.lg,
    minHeight: 40,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
  },
  actionText: { fontSize: 13, fontWeight: '700', color: Brand.white },
  pressed: { opacity: 0.75 },
});
