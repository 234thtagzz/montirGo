/**
 * Lapisan 1: Token primitif (satu-satunya file yang boleh mendeklarasikan nilai warna mentah).
 * Seluruh warna komponen & layar wajib mengonsumsi token semantik dari `@/theme`.
 */

export const Palette = {
  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    450: '#74849A',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#0B1120',
  },
  darkSurface: '#111827',
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    800: '#1E40AF',
    900: '#1E3A8A',
    950: '#172554',
  },
  orange: {
    50: '#FFF7ED',
    200: '#FED7AA',
    400: '#FB923C',
    500: '#F97316',
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
    950: '#431407',
  },
  emerald: {
    50: '#ECFDF5',
    200: '#A7F3D0',
    400: '#34D399',
    700: '#047857',
    800: '#065F46',
    950: '#064E3B',
  },
  amber: {
    50: '#FFFBEB',
    200: '#FDE68A',
    400: '#FBBF24',
    700: '#B45309',
    900: '#78350F',
    950: '#451A03',
  },
  red: {
    50: '#FEF2F2',
    200: '#FECACA',
    400: '#F87171',
    700: '#B91C1C',
    900: '#7F1D1D',
    950: '#450A0A',
  },
  indigo: {
    400: '#818CF8',
    700: '#4338CA',
  },
  teal: {
    400: '#2DD4BF',
    700: '#0F766E',
  },
  whatsapp: {
    light: '#15803D',
    dark: '#4ADE80',
  },
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  scrim: {
    light: 'rgba(11, 17, 32, 0.56)',
    dark: 'rgba(2, 6, 23, 0.72)',
  },
  shadow: {
    light: '#0B1120',
    dark: '#000000',
  },
  overlayBorderLight: 'rgba(255, 255, 255, 0.16)',
  overlaySubtleLight: 'rgba(255, 255, 255, 0.08)',
  overlayTrackLight: 'rgba(255, 255, 255, 0.14)',
  overlayBlueGlow: 'rgba(96, 165, 250, 0.24)',
  overlayBlueClear: 'rgba(11, 17, 32, 0)',
  overlayOrangeGlow: 'rgba(251, 146, 60, 0.16)',
  overlayOrangeClear: 'rgba(251, 146, 60, 0)',
  overlayVignetteStart: 'rgba(11, 17, 32, 0)',
  overlayVignetteEnd: 'rgba(11, 17, 32, 0.88)',
} as const;

/** Semua pasangan avatar terverifikasi >= 5.0:1 terhadap teks `#FFFFFF`. */
export const AvatarPaletteLight = [
  Palette.blue[900],
  Palette.emerald[700],
  Palette.amber[700],
  Palette.indigo[700],
  Palette.teal[700],
  Palette.orange[800],
] as const;

/** Semua pasangan avatar terverifikasi >= 7.0:1 terhadap teks `#0B1120`. */
export const AvatarPaletteDark = [
  Palette.blue[400],
  Palette.emerald[400],
  Palette.amber[400],
  Palette.indigo[400],
  Palette.teal[400],
  Palette.orange[400],
] as const;

export const Spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  screenPadding: 20,
} as const;

export const Radii = {
  xs: 8,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  sheet: 24,
  pill: 999,
} as const;

export const TouchTarget = {
  min: 48,
  cta: 56,
} as const;

export const Motion = {
  fast: 150,
  base: 220,
  slow: 320,
  spring: {
    damping: 20,
    stiffness: 220,
    mass: 0.9,
  },
} as const;
