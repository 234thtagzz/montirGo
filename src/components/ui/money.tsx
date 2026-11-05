import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Brand, Tabular } from '@/constants/brand';

type MoneySize = 'hero' | 'lg' | 'md' | 'sm';

interface MoneyProps {
  value: number;
  size?: MoneySize;
  color?: string;
  /** Warna untuk "Rp" kecil di depan nominal. */
  prefixColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const SIZES: Record<
  MoneySize,
  { number: TextStyle; prefix: TextStyle; gap: number }
> = {
  hero: {
    number: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.4 },
    prefix: { fontSize: 15, lineHeight: 20, fontWeight: '700', marginBottom: 4 },
    gap: 2,
  },
  lg: {
    number: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -1 },
    prefix: { fontSize: 13, lineHeight: 18, fontWeight: '700', marginBottom: 3 },
    gap: 2,
  },
  md: {
    number: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.4 },
    prefix: { fontSize: 11, lineHeight: 15, fontWeight: '600', marginBottom: 2 },
    gap: 1,
  },
  sm: {
    number: { fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: -0.2 },
    prefix: { fontSize: 10, lineHeight: 13, fontWeight: '600' },
    gap: 1,
  },
};

/**
 * Nominal Rupiah dengan "Rp" kecil dan angka besar bertabular.
 * Dipakai agar angka finansial punya hierarki yang konsisten di semua layar.
 */
export function Money({
  value,
  size = 'md',
  color = Brand.text,
  prefixColor,
  style,
  textStyle,
}: MoneyProps) {
  const scale = SIZES[size];
  const amount = Math.round(value).toLocaleString('id-ID');

  return (
    <View style={[styles.row, { gap: scale.gap }, style]}>
      <Text
        style={[scale.prefix, Tabular, { color: prefixColor ?? color, opacity: 0.72 }]}
      >
        Rp
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[scale.number, Tabular, { color }, textStyle]}
      >
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
});
