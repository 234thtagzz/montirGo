import { Alert, Linking } from 'react-native';

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

/**
 * Buka chat WhatsApp dengan kontak terkait.
 * Mengembalikan false (dan menampilkan pesan) bila nomor tidak valid.
 */
export async function openWhatsApp(
  phone: string | null | undefined,
  message?: string,
): Promise<boolean> {
  const url = buildWhatsAppUrl(phone, message);
  if (!url) {
    Alert.alert(
      'Nomor tidak tersedia',
      'Nomor WhatsApp kontak ini belum diisi atau formatnya tidak dikenali.',
    );
    return false;
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(
      'Gagal membuka WhatsApp',
      'Pastikan aplikasi WhatsApp terpasang di perangkat ini, lalu coba lagi.',
    );
    return false;
  }
}
