/**
 * Token visual MontirGo.
 *
 * Arah desain: "Night Garage" — permukaan ink/navy untuk area komando,
 * biru elektrik untuk aksi, dan hijau hanya untuk uang masuk / status sukses.
 * Volt dipakai sangat terbatas sebagai sinyal "live/online".
 *
 * Nama token lama tetap dipertahankan agar layar yang belum disentuh
 * tidak kehilangan referensi.
 */

import type { TextStyle } from 'react-native';

export const Brand = {
  // Biru aksi (mengikuti splash & ikon aplikasi).
  primary: '#0B6BFF',
  primaryDark: '#0847C4',
  primarySoft: '#EBF1FF',
  primaryBorder: '#C8DBFF',

  // Permukaan komando.
  ink: '#0B1220',
  inkSoft: '#151F33',
  inkBorder: '#243049',
  inkText: '#DCE4F5',
  inkMuted: '#8C99B4',

  /** Aksen sinyal live/online. Hanya untuk latar gelap atau titik kecil. */
  volt: '#C9F158',

  // Status.
  green: '#0E9F6E',
  greenSoft: '#E7F8F1',
  /** Hijau resmi WhatsApp untuk tombol chat. */
  whatsapp: '#25D366',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  red: '#D92D20',
  redSoft: '#FEECEB',
  blueSoft: '#EBF1FF',

  // Netral.
  background: '#F3F5F9',
  surface: '#FFFFFF',
  text: '#0E1626',
  textSecondary: '#5A6475',
  textMuted: '#8A94A6',
  border: '#E3E8F0',
  divider: '#EDF1F6',
  white: '#FFFFFF',
} as const;

/** Gradient. Header memakai ink agar identitas terasa seperti produk otomotif. */
export const Gradient = {
  header: ['#141F35', '#0B1220'] as const,
  ink: ['#1A2740', '#0B1220'] as const,
  splash: ['#2E9BFF', '#0B74E5', '#0A5FC0', '#073E80'] as const,
  promoBlue: ['#1E6BFF', '#0B4FD6'] as const,
  promoGreen: ['#12A874', '#087A4F'] as const,
  promoAmber: ['#F5B544', '#D98A0B'] as const,
} as const;

export const Radius = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
  pill: 999,
} as const;

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/** Skala tipografi. Jangan menambah ukuran baru di luar skala ini. */
export const Type = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1 },
  h1: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6 },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  meta: { fontSize: 11, lineHeight: 15, fontWeight: '500' },
  micro: { fontSize: 10, lineHeight: 13, fontWeight: '700', letterSpacing: 0.6 },
} as const satisfies Record<string, TextStyle>;

/** Angka finansial selalu rata kolom. */
export const Tabular = { fontVariant: ['tabular-nums' as const] };

/** Bayangan kartu yang konsisten di iOS/Android/web. */
export const CardShadow = {
  shadowColor: '#0B1B33',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.07,
  shadowRadius: 16,
  elevation: 4,
} as const;

export const ScreenPadding = 20;
