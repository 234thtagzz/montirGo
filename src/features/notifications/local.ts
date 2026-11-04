// Notifikasi lokal (notification shade HP) berbasis expo-notifications.
//
// Catatan: notifikasi lokal hanya bisa muncul selama aplikasi masih hidup
// (foreground/background singkat). Notifikasi saat aplikasi benar-benar
// ditutup membutuhkan push notification (token Expo + FCM/APNs) dan build
// development/production.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Brand } from '@/constants/brand';

export const REQUESTS_CHANNEL_ID = 'requests';
export const ORDERS_CHANNEL_ID = 'orders';

/** Menentukan layar yang dibuka saat notifikasi lokal diketuk. */
export type LocalAlertAudience = 'client' | 'mechanic';

// Banner tetap tampil walau aplikasi sedang dibuka.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;

// `Notifications.IosAuthorizationStatus.PROVISIONAL` dan
// `Notifications.AndroidImportance.HIGH` adalah enum re-export yang tidak
// terbaca oleh rule eslint import/namespace.
const IOS_PROVISIONAL = 3;
const ANDROID_IMPORTANCE_HIGH = 6;

function isGranted(status: Notifications.NotificationPermissionsStatus): boolean {
  return status.granted || status.ios?.status === IOS_PROVISIONAL;
}

/** Siapkan channel Android + minta izin notifikasi (sekali per sesi). */
export async function prepareNotifications(): Promise<boolean> {
  if (Platform.OS === 'android' && !channelReady) {
    channelReady = true;
    await Notifications.setNotificationChannelAsync(REQUESTS_CHANNEL_ID, {
      name: 'Request masuk',
      description: 'Pemberitahuan saat ada request baru di sekitarmu.',
      importance: ANDROID_IMPORTANCE_HIGH as Notifications.AndroidImportance,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Brand.primary,
      sound: 'default',
    }).catch(() => {
      // Channel gagal dibuat — notifikasi tetap memakai channel bawaan sistem.
    });

    await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL_ID, {
      name: 'Pesanan',
      description: 'Pemberitahuan status pesanan dan konfirmasi montir.',
      importance: ANDROID_IMPORTANCE_HIGH as Notifications.AndroidImportance,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Brand.primary,
      sound: 'default',
    }).catch(() => {
      // Channel gagal dibuat — notifikasi tetap memakai channel bawaan sistem.
    });
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    if (isGranted(current)) return true;

    const asked = await Notifications.requestPermissionsAsync();
    return isGranted(asked);
  } catch {
    return false;
  }
}

interface LocalAlertInput {
  title: string;
  body?: string | null;
  /** Request yang bisa dibuka saat notifikasi diketuk. */
  requestId?: string | null;
  /** Jenis notifikasi (`assignment_requested`, `new_request`, dst.). */
  type?: string | null;
  /** Siapa penerima notifikasi; menentukan tujuan navigasi. */
  audience?: LocalAlertAudience;
}

/** Tampilkan notifikasi lokal seketika di notification shade HP. */
export async function presentLocalAlert({
  title,
  body,
  requestId,
  type,
  audience = 'mechanic',
}: LocalAlertInput): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: body ?? undefined,
        sound: 'default',
        data: requestId ? { requestId, audience, type: type ?? null } : {},
      },
      trigger: {
        channelId: audience === 'client' ? ORDERS_CHANNEL_ID : REQUESTS_CHANNEL_ID,
      },
    });
  } catch {
    // Notifikasi bersifat pelengkap — jangan sampai mengganggu alur aplikasi.
  }
}
