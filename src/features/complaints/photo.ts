// Unggah & tampilkan foto lampiran keluahan.
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
import { supabase } from '@/lib/supabase';

export const COMPLAINT_PHOTO_BUCKET = 'complaint-photos';
export const MAX_COMPLAINT_PHOTOS = 3;

export interface PickedComplaintPhoto {
  uri: string;
  mimeType: string;
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 jam
const SIGNED_URL_SAFETY_MS = 5 * 60 * 1000;

/** Buka galeri & kembalikan pilihan (maksimal MAX_COMPLAINT_PHOTOS, batalkan -> []). */
export async function pickComplaintPhotos(): Promise<PickedComplaintPhoto[]> {
  // Sejak SDK 54 pemilih galeri sistem tidak memerlukan izin media library.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // crop ganda tidak didukung saat pemilihan ganda — biarkan pilih saja.
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: MAX_COMPLAINT_PHOTOS,
    quality: 0.7,
    exif: false,
  });
  if (result.canceled) return [];
  return result.assets
    .slice(0, MAX_COMPLAINT_PHOTOS)
    .map((asset) => ({
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
 * Unggah foto keluahan milik pelapor. Path selalu diawali `ownerId/requestId/`,
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

/** Hapus objek foto; kegagalan diabaikan agar tidak menggagalkan penyimpanan keluahan. */
export async function deleteComplaintPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  for (const path of paths) signedUrlCache.delete(path);
  await supabase.storage.from(COMPLAINT_PHOTO_BUCKET).remove(paths).catch(() => {});
}

/**
 * Ubah nilai path foto menjadi URL yang bisa ditampilkan.
 * - path objek bucket privat -> signed URL (di-cache sampai hampir kedaluwarsa)
 */
export async function resolveComplaintPhotoUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const now = Date.now();
  const cached = signedUrlCache.get(value);
  if (cached && cached.expiresAt - SIGNED_URL_SAFETY_MS > now) return cached.url;

  const { data, error } = await supabase
    .storage
    .from(COMPLAINT_PHOTO_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  signedUrlCache.set(value, { url: data.signedUrl, expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000 });
  return data.signedUrl;
}
