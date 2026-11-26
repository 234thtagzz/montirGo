// Pendaftaran Expo Push Token + cleanup saat logout.
// Di Expo Go (`storeClient`) atau web, remote push token dilewati secara aman.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const PUSH_TOKEN_STORAGE_KEY = 'montirgo_expo_push_token';
// AndroidImportance.HIGH re-export tidak selalu terbaca eslint import/namespace.
const ANDROID_IMPORTANCE_HIGH = 6;
let cachedPushToken: string | null = null;

function isRemotePushSupported(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return true;
}

function getEasProjectId(): string | undefined {
  const fromExpoConfig = (Constants.expoConfig as { extra?: { eas?: { projectId?: unknown } } } | null)
    ?.extra?.eas?.projectId;
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.trim()) {
    return fromExpoConfig.trim();
  }
  const fromEasConfig = (Constants as { easConfig?: { projectId?: unknown } }).easConfig?.projectId;
  if (typeof fromEasConfig === 'string' && fromEasConfig.trim()) {
    return fromEasConfig.trim();
  }
  return undefined;
}

/** Daftarkan device push token milik user aktif ke `device_push_tokens`. */
export async function registerPushToken(): Promise<string | null> {
  if (!isRemotePushSupported()) return null;

  try {
    const existingPerm = await Notifications.getPermissionsAsync();
    let finalStatus = existingPerm.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('montirgo-alerts', {
        name: 'Notifikasi MontirGo',
        importance: ANDROID_IMPORTANCE_HIGH,
        vibrationPattern: [0, 200, 120, 200],
      }).catch(() => {});
    }

    const projectId = getEasProjectId();
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResult.data?.trim();
    if (!token) return null;

    cachedPushToken = token;
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token).catch(() => {});

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceName = typeof Constants.deviceName === 'string' ? Constants.deviceName : null;

    await supabase.rpc('upsert_my_push_token', {
      p_token: token,
      p_platform: platform,
      p_device_name: deviceName,
    });

    return token;
  } catch {
    // Gagal registrasi push tidak boleh memblokir jalannya aplikasi.
    return null;
  }
}

/** Nonaktifkan token device saat user logout agar akun sebelumnya tidak menerima notif. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token =
      cachedPushToken ?? (await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY).catch(() => null));
    cachedPushToken = null;
    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY).catch(() => {});
    if (!token) return;

    await supabase.rpc('deactivate_my_push_token', { p_token: token });
  } catch {
    // Abaikan error network/session saat sign-out.
  }
}
