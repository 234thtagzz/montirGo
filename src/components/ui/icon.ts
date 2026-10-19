import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

/** Nama ikon Ionicons yang type-safe. */
export type IconName = ComponentProps<typeof Ionicons>['name'];

export { Ionicons };
