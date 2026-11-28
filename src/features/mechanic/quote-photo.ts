import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import {
  QUOTE_PHOTO_BUCKET,
  forgetQuotePhotoUrl,
  resolveQuotePhotoUrls,
} from '@/features/service-request/quote-photo-urls';
import { supabase } from '@/lib/supabase';

export { QUOTE_PHOTO_BUCKET, forgetQuotePhotoUrl, resolveQuotePhotoUrls };

export const MAX_QUOTE_PHOTOS = 3;
export const MAX_QUOTE_PHOTO_BYTES = 300 * 1024;
const BUCKET_HARD_LIMIT_BYTES = 512 * 1024;

export interface PreparedQuotePhoto {
  uri: string;
  mimeType: string;
  sizeBytes: number;
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

async function compressToJpeg(
  uri: string,
  maxWidth: number,
  compress: number,
): Promise<{ uri: string; bytes: ArrayBuffer }> {
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const ctx = ImageManipulator.manipulate(uri, { maxWidth });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({
    compress,
    format: SaveFormat.JPEG,
  });
  const bytes = await readBytes(saved.uri);
  return { uri: saved.uri, bytes };
}

/**
 * Ambil 1 foto bukti kerusakan dari kamera atau galeri, lalu kompres <= 300 KB
 * agar hemat kuota saat montir berada di area sinyal 1-bar.
 */
export async function pickQuotePhoto(
  source: 'camera' | 'gallery',
): Promise<PreparedQuotePhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error(
        'Izin kamera diperlukan untuk memotret kerusakan. Aktifkan di Pengaturan perangkat.',
      );
    }
  }

  const pickerResult =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.55,
          exif: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.55,
          exif: false,
        });

  if (pickerResult.canceled || !pickerResult.assets.length) return null;
  const asset = pickerResult.assets[0];

  try {
    let pass = await compressToJpeg(asset.uri, 1080, 0.6);
    if (pass.bytes.byteLength > MAX_QUOTE_PHOTO_BYTES) {
      pass = await compressToJpeg(asset.uri, 800, 0.42);
    }
    if (pass.bytes.byteLength > BUCKET_HARD_LIMIT_BYTES) {
      throw new Error('Ukuran foto terlalu besar (> 512 KB). Pilih foto lain.');
    }
    return {
      uri: pass.uri,
      mimeType: 'image/jpeg',
      sizeBytes: pass.bytes.byteLength,
    };
  } catch (err) {
    // Fallback aman bila native ImageManipulator belum tersedia pada Dev Build lama.
    const rawBytes = await readBytes(asset.uri);
    if (rawBytes.byteLength > BUCKET_HARD_LIMIT_BYTES) {
      throw err instanceof Error
        ? err
        : new Error('Ukuran foto melebihi 512 KB setelah kompresi.');
    }
    return {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      sizeBytes: rawBytes.byteLength,
    };
  }
}

/**
 * Unggah foto bukti estimasi ke bucket privat `quote-photos`.
 * Path wajib berformat `<request_id>/<mechanic_id>/<filename>` agar lolos RLS.
 */
export async function uploadQuotePhoto(
  requestId: string,
  mechanicId: string,
  photo: PreparedQuotePhoto,
): Promise<string> {
  const bytes = await readBytes(photo.uri);
  if (bytes.byteLength > BUCKET_HARD_LIMIT_BYTES) {
    throw new Error('Ukuran foto maksimal 512 KB.');
  }
  const path = `${requestId}/${mechanicId}/quote-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;

  const { error } = await supabase.storage
    .from(QUOTE_PHOTO_BUCKET)
    .upload(path, bytes, {
      cacheControl: '3600',
      contentType: photo.mimeType || 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(
      error.message || 'Gagal mengunggah foto bukti. Coba lagi atau kirim estimasi tanpa foto.',
    );
  }
  return path;
}

/** Hapus 1 foto bukti estimasi milik montir. */
export async function deleteQuotePhoto(path: string): Promise<void> {
  if (!path) return;
  forgetQuotePhotoUrl(path);
  await supabase.storage.from(QUOTE_PHOTO_BUCKET).remove([path]);
}
