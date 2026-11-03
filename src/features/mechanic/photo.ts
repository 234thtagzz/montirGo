// Unggah & tampilkan foto profil montir dan foto bengkel.
//
// Dua jenis penyimpanan mengikuti policy RLS yang berbeda:
// - Foto profil (`avatars`, publik): yang disimpan adalah URL publik hasil
//   `getPublicUrl`.
// - Foto bengkel (`workshop-photos`, privat): yang disimpan adalah *path*
//   objek; aplikasi membuat signed URL singkat saat menampilkan.
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export const MECHANIC_AVATAR_BUCKET = 'avatars';
export const WORKSHOP_PHOTO_BUCKET = 'workshop-photos';

/** Batas foto bengkel — cukup untuk mengenali tempat, tidak membebani storage. */
export const MAX_WORKSHOP_PHOTOS = 5;

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 jam
const SIGNED_URL_SAFETY_MS = 5 * 60 * 1000;

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export interface PickedMechanicPhoto {
  uri: string;
  mimeType: string;
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

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

/** Buka galeri dan kembalikan gambar terpilih (null bila dibatalkan). */
export async function pickMechanicPhoto(
  aspect: [number, number] = [1, 1],
): Promise<PickedMechanicPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.75,
    exif: false,
  });
  if (result.canceled || !result.assets.length) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

async function uploadPublicImage(
  bucket: string,
  userId: string,
  prefix: string,
  photo: PickedMechanicPhoto,
): Promise<string> {
  const bytes = await readBytes(photo.uri);
  const path = `${userId}/${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extensionFor(photo.mimeType, photo.uri)}`;

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    cacheControl: '3600',
    contentType: photo.mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(error.message || 'Gagal mengunggah foto. Periksa koneksi lalu coba lagi.');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error('Foto terunggah, tetapi URL publik tidak tersedia.');
  }
  return data.publicUrl;
}

export function uploadMechanicAvatar(
  userId: string,
  photo: PickedMechanicPhoto,
): Promise<string> {
  return uploadPublicImage(MECHANIC_AVATAR_BUCKET, userId, 'avatar', photo);
}

/**
 * Unggah satu foto bengkel ke bucket privat.
 * Path selalu diawali folder owner agar policy storage bisa memvalidasi.
 * Mengembalikan path objek (bukan URL) untuk disimpan di
 * `mechanic_profiles.workshop_photos`.
 */
export async function uploadWorkshopPhoto(
  ownerId: string,
  photo: PickedMechanicPhoto,
): Promise<string> {
  const bytes = await readBytes(photo.uri);
  const path = `${ownerId}/workshop-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extensionFor(photo.mimeType, photo.uri)}`;

  const { error } = await supabase.storage.from(WORKSHOP_PHOTO_BUCKET).upload(path, bytes, {
    cacheControl: '3600',
    contentType: photo.mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      error.message || 'Gagal mengunggah foto bengkel. Periksa koneksi lalu coba lagi.',
    );
  }
  return path;
}

/** Hapus objek foto bengkel; kegagalan diabaikan agar tidak menggagalkan penyimpanan. */
export async function deleteWorkshopPhotos(paths: string[] | null | undefined): Promise<void> {
  const items = (paths ?? []).filter((path) => path && !/^https?:/i.test(path));
  if (items.length === 0) return;
  items.forEach((path) => signedUrlCache.delete(path));
  await supabase.storage.from(WORKSHOP_PHOTO_BUCKET).remove(items);
}

/** Tukar path foto bengkel menjadi signed URL (di-cache sampai hampir kedaluwarsa). */
export async function resolveWorkshopPhotoUrls(
  paths: string[] | null | undefined,
): Promise<Record<string, string>> {
  const items = (paths ?? []).filter(Boolean);
  if (items.length === 0) return {};

  const now = Date.now();
  const resolved: Record<string, string> = {};
  const missing: string[] = [];

  for (const path of items) {
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt - SIGNED_URL_SAFETY_MS > now) {
      resolved[path] = cached.url;
    } else {
      missing.push(path);
    }
  }

  if (missing.length === 0) return resolved;

  const { data, error } = await supabase.storage
    .from(WORKSHOP_PHOTO_BUCKET)
    .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return resolved;

  for (const item of data) {
    if (!item.signedUrl || !item.path) continue;
    resolved[item.path] = item.signedUrl;
    signedUrlCache.set(item.path, {
      url: item.signedUrl,
      expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
    });
  }
  return resolved;
}
