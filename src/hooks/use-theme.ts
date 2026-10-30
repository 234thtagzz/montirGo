/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();

  // RN 0.88 mengetik `useColorScheme()` sebagai 'light' | 'dark' | null.
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
