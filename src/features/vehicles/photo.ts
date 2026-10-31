// Unggah & tampilkan foto kendaraan.
//
// Bucket `vehicle-photos` bersifat privat. Yang disimpan di kolom
// `vehicles.photo_url` adalah *path* objek, bukan URL publik. Saat ditampilkan
// aplikasi membuat signed URL singkat (lihat resolveVehiclePhotoUrl).
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export const VEHICLE_PHOTO_BUCKET = 'vehicle-photos';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 jam
const SIGNED_URL_SAFETY_MS = 5 * 60 * 1000;

export interface PickedVehiclePhoto {
  uri: string;
  mimeType: string;
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function isRemoteUri(value: string): boolean {
  return /^(https?:|data:|file:|content:|blob:)/i.test(value);
}

function extensionFor(mimeType: string, uri: string): string {
  const fromMime = mimeType.split('/')[1]?.split(';')[0]?.trim();
  if (fromMime && /^[a-z0-9]+$/i.test(fromMime)) {
    return fromMime === 'jpeg' ? 'jpg' : fromMime.toLowerCase();
  }
  const fromUri = uri.split('?')[0]?.split('.').pop();
  if (fromUri && /^[a-z0-9]{2,5}$/i.test(fromUri)) return fromUri.toLowerCase();
  return 'jpg';
}

/** Buka galeri dan kembalikan gambar terpilih (null bila client membatalkan). */
export async function pickVehiclePhoto(): Promise<PickedVehiclePhoto | null> {
  // Sejak SDK 54 pemilih galeri sistem tidak memerlukan izin media library
  // untuk gambar. Tidak perlu dialog izin tambahan.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
    exif: false,
  });
  if (result.canceled || !result.assets.length) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  // API File baru (expo-file-system) mendukung file:// maupun content://.
  return new File(uri).arrayBuffer();
}

/**
 * Unggah foto kendaraan milik `ownerId`.
 * Path selalu diawali folder owner agar policy storage bisa memvalidasi.
 * Mengembalikan path objek (bukan URL) untuk disimpan di `vehicles.photo_url`.
 */
export async function uploadVehiclePhoto(
  ownerId: string,
  photo: PickedVehiclePhoto,
): Promise<string> {
  const bytes = await readBytes(photo.uri);
  const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(
    photo.mimeType,
    photo.uri,
  )}`;

  const { error } = await supabase.storage.from(VEHICLE_PHOTO_BUCKET).upload(path, bytes, {
    cacheControl: '3600',
    contentType: photo.mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      error.message || 'Gagal mengunggah foto kendaraan. Periksa koneksi lalu coba lagi.',
    );
  }
  return path;
}

/** Hapus objek foto lama; kegagalan diabaikan agar tidak menggagalkan penyimpanan data. */
export async function deleteVehiclePhoto(path: string | null | undefined): Promise<void> {
  if (!path || isRemoteUri(path)) return;
  signedUrlCache.delete(path);
  await supabase.storage.from(VEHICLE_PHOTO_BUCKET).remove([path]);
}

/**
 * Ubah nilai `vehicles.photo_url` menjadi URL yang bisa ditampilkan.
 * - path objek bucket privat -> signed URL (di-cache sampai hampir kedaluwarsa)
 * - URL lama (mis. dari data sebelum bucket privat) -> dikembalikan apa adanya
 */
export async function resolveVehiclePhotoUrl(
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  if (isRemoteUri(value)) return value;

  const now = Date.now();
  const cached = signedUrlCache.get(value);
  if (cached && cached.expiresAt - SIGNED_URL_SAFETY_MS > now) return cached.url;

  const { data, error } = await supabase.storage
    .from(VEHICLE_PHOTO_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  signedUrlCache.set(value, {
    url: data.signedUrl,
    expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}
