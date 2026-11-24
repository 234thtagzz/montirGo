// Unggah & tampilkan foto lampiran keluhan.
//
// Bucket `complaint-photos` bersifat privat. Yang disimpan di kolom
// `complaints.photo_paths` adalah *path* objek, bukan URL publik. Saat
// ditampilkan aplikasi membuat signed URL singkat (lihat resolveComplaintPhotoUrl).
//
// Policy storage (lihat migrasi 20261120000000):
//   - upload: hanya folder pertama = auth.uid() (pelapor bisa unggah sendiri)
//   - select: pelapor miliknya atau pengguna memiliki role admin
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { forgetSignedUrl, readSignedUrl, writeSignedUrl } from '@/lib/signed-url-cache';
import { supabase } from '@/lib/supabase';

export const COMPLAINT_PHOTO_BUCKET = 'complaint-photos';
export const MAX_COMPLAINT_PHOTOS = 3;

export interface PickedComplaintPhoto {
  uri: string;
  mimeType: string;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 jam
const CACHE_NAMESPACE = 'complaint-photos';

/** Buka galeri & kembalikan pilihan (maksimal `limit`, batalkan -> []). */
export async function pickComplaintPhotos(
  limit = MAX_COMPLAINT_PHOTOS,
): Promise<PickedComplaintPhoto[]> {
  // Sejak SDK 54 pemilih galeri sistem tidak memerlukan izin media library.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // crop ganda tidak didukung saat pemilihan ganda — biarkan pilih saja.
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 0.7,
    exif: false,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((asset) => ({
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
  }));
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  // API File baru (expo-file-system) mendukung file:// maupun content://.
  return new File(uri).arrayBuffer();
}

function extensionFor(mimeType: string, uri: string): string {
  const fromMime = mimeType.split('/')[1]?.split(';')[0]?.trim();
  if (fromMime && /^[a-z0-9]+$/i.test(fromMime)) return fromMime.toLowerCase();
  const fromUri = uri.split('?')[0]?.split('.').pop();
  if (fromUri && /^[a-z0-9]{2,5}$/i.test(fromUri)) return fromUri.toLowerCase();
  return 'jpg';
}

/**
 * Unggah foto keluhan milik pelapor. Path selalu diawali `ownerId/requestId/`,
 * path ini dipakai di kolom `complaints.photo_paths`.
 */
export async function uploadComplaintPhoto(
  ownerId: string,
  requestId: string,
  photo: PickedComplaintPhoto,
): Promise<string> {
  const bytes = await readBytes(photo.uri);
  const path = `${ownerId}/${requestId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extensionFor(photo.mimeType, photo.uri)}`;

  const { error } = await supabase.storage.from(COMPLAINT_PHOTO_BUCKET).upload(path, bytes, {
    cacheControl: '3600',
    contentType: photo.mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      error.message || 'Gagal mengunggah foto lampiran. Periksa koneksi lalu coba lagi.',
    );
  }
  return path;
}

/** Hapus objek foto; kegagalan diabaikan agar tidak menggagalkan penyimpanan keluhan. */
export async function deleteComplaintPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  for (const path of paths) forgetSignedUrl(CACHE_NAMESPACE, path);
  await supabase.storage.from(COMPLAINT_PHOTO_BUCKET).remove(paths).catch(() => {});
}

/**
 * Ubah nilai path foto menjadi URL yang bisa ditampilkan.
 * - path objek bucket privat -> signed URL (di-cache sampai hampir kedaluwarsa)
 * `force` memaksa URL baru untuk path yang gambarnya gagal dimuat.
 */
export async function resolveComplaintPhotoUrl(
  value: string | null | undefined,
  options?: { force?: boolean },
): Promise<string | null> {
  if (!value) return null;

  if (!options?.force) {
    const cached = readSignedUrl(CACHE_NAMESPACE, value);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .storage
    .from(COMPLAINT_PHOTO_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  writeSignedUrl(CACHE_NAMESPACE, value, data.signedUrl, SIGNED_URL_TTL_SECONDS);
  return data.signedUrl;
}

/** Buang signed URL yang gagal dimuat agar permintaan berikutnya membuat URL baru. */
export function forgetComplaintPhotoUrl(value: string | null | undefined): void {
  if (!value) return;
  forgetSignedUrl(CACHE_NAMESPACE, value);
}
