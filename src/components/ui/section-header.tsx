import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand, Space } from '@/constants/brand';
import { Ionicons } from '@/components/ui/icon';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onPressAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onPressAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onPressAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={Brand.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.xxl,
    marginBottom: Space.md,
  },
  title: { fontSize: 16, fontWeight: '700', color: Brand.text },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontSize: 13, fontWeight: '600', color: Brand.primary },
  pressed: { opacity: 0.6 },
});
