/**
 * Token visual brand MontirGo untuk section client.
 * Dipisah dari `theme.ts` (warna light/dark bawaan template) agar layar client
 * punya identitas sendiri tanpa mengubah komponen themed yang sudah ada.
 */

export const Brand = {
  // Biru mengikuti splash screen + ikon aplikasi.
  primary: '#0B74E5',
  primaryDark: '#0A5FC0',
  primarySoft: '#E8F1FF',
  primaryBorder: '#C7DDFB',

  // Aksen status.
  green: '#00B14F',
  greenSoft: '#E6F7EE',
  /** Hijau resmi WhatsApp untuk tombol chat. */
  whatsapp: '#25D366',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  red: '#E8112A',
  redSoft: '#FDE8EA',
  blueSoft: '#E8F1FF',

  // Netral.
  background: '#F5F7FA',
  surface: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#F1F3F5',
  white: '#FFFFFF',
} as const;

/** Gradient header & kartu promo (minimal 2 stop, sesuai API LinearGradient). */
export const Gradient = {
  header: ['#2E9BFF', '#0B74E5', '#0A5FC0'] as const,
  /** Latar layar loading saat aplikasi dibuka (lanjutan dari header, lebih dalam di bawah). */
  splash: ['#2E9BFF', '#0B74E5', '#0A5FC0', '#073E80'] as const,
  promoBlue: ['#1E90FF', '#0B74E5'] as const,
  promoGreen: ['#00C45A', '#009E45'] as const,
  promoAmber: ['#FBBF24', '#F59E0B'] as const,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
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
} as const;

/** Bayangan kartu yang konsisten di iOS/Android/web. */
export const CardShadow = {
  shadowColor: '#0B1B33',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

export const ScreenPadding = 20;
