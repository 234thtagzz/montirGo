import { View } from 'react-native';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { useThemedStyles, type AppTheme } from '@/theme';

interface TabIconProps {
  focused: boolean;
  color: string;
  name: IconName;
  focusedName: IconName;
}

/**
 * Ikon tab dengan indikator aktif berbentuk kapsul.
 */
export function TabIcon({ focused, color, name, focusedName }: TabIconProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.wrap, focused && styles.wrapActive]}>
      <Ionicons name={focused ? focusedName : name} size={20} color={color} />
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  wrap: {
    width: 44,
    height: 28,
    borderRadius: theme.radii.sm,
    borderCurve: theme.components.card.borderCurve,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  wrapActive: {
    backgroundColor: theme.colors.tabActiveBg,
  },
});
