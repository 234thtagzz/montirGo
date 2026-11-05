import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand, Space, Type } from '@/constants/brand';
import { Ionicons } from '@/components/ui/icon';

interface SectionHeaderProps {
  title: string;
  /** Label kecil di atas judul, mis. "ORDER". */
  eyebrow?: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SectionHeader({
  title,
  eyebrow,
  actionLabel,
  onPressAction,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {actionLabel && onPressAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onPressAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={Brand.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Space.md,
    marginTop: Space.xxl,
    marginBottom: Space.md,
  },
  copy: { flex: 1 },
  eyebrow: { ...Type.micro, color: Brand.textMuted, marginBottom: 3 },
  title: { ...Type.h2, color: Brand.text },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 2 },
  actionText: { ...Type.label, color: Brand.primary, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
