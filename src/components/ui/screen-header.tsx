import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Radius, ScreenPadding, Space, Type } from '@/constants/brand';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Jika false, tombol kembali tidak ditampilkan (mis. layar root). */
  showBack?: boolean;
  right?: ReactNode;
}

/**
 * Header layar pendalaman. Sengaja tanpa border tebal: pemisah dibuat oleh
 * latar halaman, bukan garis, agar terasa lebih ringan.
 */
export function ScreenHeader({ title, subtitle, showBack = true, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.header, { paddingTop: insets.top + Space.sm }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            hitSlop={8}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(client)/(tabs)')
            }
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={20} color={Brand.text} />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        <View style={styles.titleBox}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Brand.background,
    paddingHorizontal: ScreenPadding,
    paddingBottom: Space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  back: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: { width: 40 },
  titleBox: { flex: 1 },
  title: { ...Type.h2, color: Brand.text },
  subtitle: { ...Type.meta, color: Brand.textSecondary, marginTop: 1 },
  right: { minWidth: 40, alignItems: 'flex-end' },
  pressed: { opacity: 0.6 },
});
