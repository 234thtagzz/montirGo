// Unggah foto profil montir.
//
// Bucket `avatars` bersifat publik, jadi yang disimpan di database adalah URL
// publik hasil `getPublicUrl` (bukan path objek).
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export const MECHANIC_AVATAR_BUCKET = 'avatars';

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
