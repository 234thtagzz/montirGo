import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';

/** Tinggi area ikon + label tab (tanpa inset sistem). */
const CONTENT_HEIGHT = 60;
/**
 * Jarak minimum dari tepi bawah untuk perangkat yang tidak melaporkan inset
 * (mis. navigasi tombol fisik). Mencegah tab bar menempel di tepi layar.
 */
const MIN_BOTTOM_INSET = 8;
const TOP_PADDING = 7;

/**
 * Gaya tab bar bawah yang mengikuti safe-area perangkat dan tema aktif (Light/Dark).
 */
export function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const bottomInset = Math.max(insets.bottom, MIN_BOTTOM_INSET);

  return {
    height: CONTENT_HEIGHT + bottomInset,
    paddingTop: TOP_PADDING,
    paddingBottom: bottomInset,
    backgroundColor: theme.colors.tabBarBg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.tabBarBorder,
  };
}
