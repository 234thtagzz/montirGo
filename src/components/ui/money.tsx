import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { FontFamily, TabularNums, useAppTheme } from '@/theme';

type MoneySize = 'hero' | 'lg' | 'md' | 'sm';

interface MoneyProps {
  value: number;
  size?: MoneySize;
  color?: string;
  /** Warna untuk "Rp" kecil di depan nominal. */
  prefixColor?: string;
  /** Set true bila dipakai di dalam komponen `<Text>` agar tidak menyisipkan `<View>`. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const SIZES: Record<MoneySize, { number: TextStyle; prefix: TextStyle; gap: number }> = {
  hero: {
    number: { fontFamily: FontFamily.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1.1 },
    prefix: { fontFamily: FontFamily.bold, fontSize: 15, lineHeight: 20, marginBottom: 4 },
    gap: 3,
  },
  lg: {
    number: { fontFamily: FontFamily.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.8 },
    prefix: { fontFamily: FontFamily.bold, fontSize: 13, lineHeight: 18, marginBottom: 3 },
    gap: 2,
  },
  md: {
    number: { fontFamily: FontFamily.bold, fontSize: 18, lineHeight: 24, letterSpacing: -0.3 },
    prefix: { fontFamily: FontFamily.semibold, fontSize: 12, lineHeight: 16, marginBottom: 2 },
    gap: 2,
  },
  sm: {
    number: { fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 18, letterSpacing: -0.2 },
    prefix: { fontFamily: FontFamily.semibold, fontSize: 11, lineHeight: 15 },
    gap: 2,
  },
};

/**
 * Nominal Rupiah dengan "Rp" kecil dan angka bertabular.
 * Gunakan prop `inline` saat berada di dalam `<Text>`.
 */
export function Money({
  value,
  size = 'md',
  color,
  prefixColor,
  inline = false,
  style,
  textStyle,
}: MoneyProps) {
  const { theme } = useAppTheme();
  const resolvedColor = color ?? theme.colors.textPrimary;
  const resolvedPrefixColor = prefixColor ?? resolvedColor;
  const scale = SIZES[size];
  const amount = Math.round(value).toLocaleString('id-ID');

  if (inline) {
    return (
      <Text style={[scale.number, TabularNums, { color: resolvedColor }, textStyle]}>
        <Text style={[scale.prefix, TabularNums, { color: resolvedPrefixColor, opacity: 0.78 }]}>
          Rp{' '}
        </Text>
        {amount}
      </Text>
    );
  }

  return (
    <View style={[styles.row, { gap: scale.gap }, style]}>
      <Text
        style={[
          scale.prefix,
          TabularNums,
          { color: resolvedPrefixColor, opacity: 0.78 },
        ]}
      >
        Rp
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[scale.number, TabularNums, { color: resolvedColor }, textStyle]}
      >
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
