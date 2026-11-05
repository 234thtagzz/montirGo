import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand, Radius, Tabular, Type } from '@/constants/brand';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** `ink` untuk dipakai di atas permukaan gelap. */
  tone?: 'light' | 'ink';
  style?: ComponentProps<typeof View>['style'];
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'light',
  style,
}: SegmentedProps<T>) {
  const dark = tone === 'ink';

  return (
    <View style={[styles.wrap, dark ? styles.wrapInk : styles.wrapLight, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.item,
              active && (dark ? styles.itemActiveInk : styles.itemActiveLight),
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.label,
                Tabular,
                dark && styles.labelInk,
                active && (dark ? styles.labelActiveInk : styles.labelActiveLight),
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: Radius.md, padding: 4, gap: 4 },
  wrapLight: { backgroundColor: '#E8ECF3' },
  wrapInk: { backgroundColor: 'rgba(255,255,255,0.09)' },
  item: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  itemActiveLight: {
    backgroundColor: Brand.surface,
    shadowColor: '#0B1B33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  itemActiveInk: { backgroundColor: 'rgba(255,255,255,0.16)' },
  label: { ...Type.label, color: Brand.textSecondary },
  labelInk: { color: Brand.inkMuted },
  labelActiveLight: { color: Brand.text, fontWeight: '700' },
  labelActiveInk: { color: Brand.white, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
