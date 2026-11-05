import { StyleSheet, View } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Brand, Radius } from '@/constants/brand';

interface TabIconProps {
  focused: boolean;
  color: string;
  name: IconName;
  focusedName: IconName;
}

/**
 * Ikon tab dengan indikator aktif berbentuk kapsul.
 * Memberi umpan balik posisi tanpa perlu tab bar kustom.
 */
export function TabIcon({ focused, color, name, focusedName }: TabIconProps) {
  return (
    <View style={[styles.wrap, focused && styles.wrapActive]}>
      <Ionicons name={focused ? focusedName : name} size={20} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapActive: { backgroundColor: Brand.primarySoft },
});
