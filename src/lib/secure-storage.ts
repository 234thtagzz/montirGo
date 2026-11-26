import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Adapter storage terenkripsi untuk Supabase Auth.
 *
 * iOS Keychain dan Android Keystore membatasi ukuran satu item (~2048 byte),
 * sedangkan JSON sesi Supabase sering melebihi batas tersebut. Pada platform
 * native nilai dipecah menjadi chunk <= 1800 byte di `expo-secure-store`;
 * pada web tetap memakai `AsyncStorage`.
 */
const CHUNK_SIZE = 1800;
const CHUNK_META_SUFFIX = '.__chunks';

function safeKey(key: string): string {
  // SecureStore hanya mengizinkan karakter [A-Za-z0-9._-]
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

function chunkKey(base: string, index: number): string {
  return `${base}.__chunk_${index}`;
}

async function readNativeItem(key: string): Promise<string | null> {
  const base = safeKey(key);
  const countRaw = await SecureStore.getItemAsync(`${base}${CHUNK_META_SUFFIX}`);
  if (!countRaw) {
    const direct = await SecureStore.getItemAsync(base);
    if (direct !== null) return direct;
    // Migrasi satu kali dari AsyncStorage lama agar user tidak perlu login ulang.
    const legacy = await AsyncStorage.getItem(key).catch(() => null);
    if (legacy !== null) {
      await writeNativeItem(key, legacy).catch(() => {});
      await AsyncStorage.removeItem(key).catch(() => {});
    }
    return legacy;
  }

  const count = Number.parseInt(countRaw, 10);
  if (!Number.isFinite(count) || count <= 0) return null;

  const parts = await Promise.all(
    Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(base, index))),
  );
  if (parts.some((part) => part === null)) return null;
  return parts.join('');
}

async function writeNativeItem(key: string, value: string): Promise<void> {
  const base = safeKey(key);
  await removeNativeItem(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(base, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    return;
  }

  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }

  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(chunkKey(base, index), chunk, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      }),
    ),
  );
  await SecureStore.setItemAsync(`${base}${CHUNK_META_SUFFIX}`, String(chunks.length), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

async function removeNativeItem(key: string): Promise<void> {
  const base = safeKey(key);
  const countRaw = await SecureStore.getItemAsync(`${base}${CHUNK_META_SUFFIX}`);
  if (countRaw) {
    const count = Number.parseInt(countRaw, 10);
    if (Number.isFinite(count) && count > 0) {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.deleteItemAsync(chunkKey(base, index)).catch(() => {}),
        ),
      );
    }
    await SecureStore.deleteItemAsync(`${base}${CHUNK_META_SUFFIX}`).catch(() => {});
  }
  await SecureStore.deleteItemAsync(base).catch(() => {});
  await AsyncStorage.removeItem(key).catch(() => {});
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return readNativeItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await writeNativeItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    await removeNativeItem(key);
  },
};
