import { Linking } from 'react-native';

export interface ExternalActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Normalisasi nomor ke format internasional tanpa tanda baca, sesuai syarat
 * tautan `wa.me` (contoh: `0812-3456-7890` -> `6281234567890`).
 */
export function normalizeWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Awalan internasional 00 (mis. 0062...) diperlakukan seperti +62.
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  // Nomor tanpa awalan 0/62, mis. 81234567890.
  if (digits.startsWith('8')) return `62${digits}`;

  return digits;
}

/** Tautan chat WhatsApp; `message` otomatis terisi di kolom kirim. */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message?: string,
): string | null {
  const number = normalizeWhatsAppNumber(phone);
  if (!number) return null;

  const text = message?.trim();
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Ambil nomor WhatsApp CS dari `platform_settings` dengan fallback env publik. */
export function getCsWhatsAppNumber(settingsNumber?: string | null): string | null {
  const fromSettings = settingsNumber?.trim();
  if (fromSettings) return fromSettings;
  const fromEnv = process.env.EXPO_PUBLIC_CS_WHATSAPP?.trim();
  return fromEnv || null;
}

/**
 * Buka chat WhatsApp dengan kontak terkait tanpa memblokir dengan Alert.alert.
 */
export async function openWhatsApp(
  phone: string | null | undefined,
  message?: string,
): Promise<ExternalActionResult> {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) {
    return {
      ok: false,
      error: 'Nomor WhatsApp belum diisi atau formatnya tidak dikenali.',
    };
  }

  try {
    await Linking.openURL(url);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Gagal membuka WhatsApp. Pastikan WhatsApp terpasang lalu coba lagi.',
    };
  }
}

/** Buka aplikasi telepon perangkat untuk fallback panggilan langsung (`tel:`). */
export async function openPhoneDialer(
  phone: string | null | undefined,
): Promise<ExternalActionResult> {
  const cleaned = (phone ?? '').replace(/[^+0-9]/g, '');
  if (!cleaned) {
    return {
      ok: false,
      error: 'Nomor telepon tidak tersedia.',
    };
  }

  try {
    await Linking.openURL(`tel:${cleaned}`);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: 'Perangkat tidak mendukung panggilan telepon.',
    };
  }
}
