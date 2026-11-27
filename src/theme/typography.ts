import type { TextStyle } from 'react-native';

/**
 * Pemetaan eksplisit per bobot Plus Jakarta Sans.
 * Dilarang menggabungkan `fontWeight` dengan `fontFamily` kustom agar Android
 * tidak jatuh ke Roboto atau menebalkan huruf secara sintetis.
 */
export const FontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'title'
  | 'body'
  | 'bodyMedium'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'overline';

/** Skala tipografi resmi. Ukuran teks minimum adalah 11px. */
export const Typography = {
  display: {
    fontFamily: FontFamily.extrabold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  h1: {
    fontFamily: FontFamily.extrabold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  bodyMedium: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 21,
  },
  bodyStrong: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 21,
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  overline: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.6,
  },
} as const satisfies Record<TypographyVariant, TextStyle>;

/** Angka finansial, jarak, dan timer selalu memakai kolom tabular. */
export const TabularNums: TextStyle = {
  fontVariant: ['tabular-nums'],
};
