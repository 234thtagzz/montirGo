import {
  StyleSheet,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/theme/theme-provider';
import type { AppTheme } from '@/theme/tokens';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
type StyleFactory<T extends NamedStyles<T>> = (theme: AppTheme) => T;

const styleCache = new WeakMap<
  StyleFactory<any>,
  WeakMap<AppTheme, Record<string, unknown>>
>();

/**
 * Mengompilasi dan men-cache StyleSheet per kombinasi (factory, theme).
 * Karena `lightTheme` & `darkTheme` adalah dua objek statis, tiap factory
 * paling banyak dievaluasi 2 kali sepanjang masa hidup aplikasi dan aman
 * untuk React Compiler.
 */
export function useThemedStyles<T extends NamedStyles<T>>(
  factory: StyleFactory<T>,
): T {
  const { theme } = useAppTheme();

  let byTheme = styleCache.get(factory);
  if (!byTheme) {
    byTheme = new WeakMap();
    styleCache.set(factory, byTheme);
  }

  let compiled = byTheme.get(theme) as T | undefined;
  if (!compiled) {
    compiled = StyleSheet.create(factory(theme));
    byTheme.set(theme, compiled);
  }

  return compiled;
}
