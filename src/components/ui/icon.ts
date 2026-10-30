import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Nama ikon Ionicons yang type-safe. */
export type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Sejak React Native 0.88 `ColorValue` juga mencakup `number` dan `null`,
 * sedangkan prop `color` Ionicons hanya menerima string/OpaqueColorValue.
 * Tab bar Expo Router mengirim string, jadi nilai lain memakai `fallback`.
 */
export function iconColor(color: ColorValue, fallback: string): string {
  return typeof color === 'string' ? color : fallback;
}

export { Ionicons };
