// Background GPS tracking task untuk perjalanan montir menuju client.
// Di Expo Go atau web, task dilewati aman sementara foreground watchPositionAsync tetap aktif.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { recordMechanicLocation } from '../service';

export const MECHANIC_BG_LOCATION_TASK = 'montirgo-mechanic-bg-location';
const ACTIVE_TRIP_REQUEST_KEY = 'montirgo_active_trip_request_id';

interface LocationTaskPayload {
  locations?: Location.LocationObject[];
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(MECHANIC_BG_LOCATION_TASK)) {
  TaskManager.defineTask<LocationTaskPayload>(MECHANIC_BG_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const requestId = await AsyncStorage.getItem(ACTIVE_TRIP_REQUEST_KEY).catch(() => null);
    if (!requestId) return;

    const latest = data.locations[data.locations.length - 1];
    if (!latest?.coords) return;

    await recordMechanicLocation(requestId, {
      lat: latest.coords.latitude,
      lng: latest.coords.longitude,
      accuracy: latest.coords.accuracy ?? null,
    }).catch(() => {
      // Abaikan gangguan jaringan sementara di background; foreground/interval berikutnya menyusul.
    });
  });
}

function canRunBackgroundLocation(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return true;
}

/** Mulai pelacakan lokasi latar belakang untuk order aktif (jika izin background diberikan). */
export async function startBackgroundTripTracking(requestId: string): Promise<boolean> {
  if (!canRunBackgroundLocation() || !requestId) return false;
  try {
    await AsyncStorage.setItem(ACTIVE_TRIP_REQUEST_KEY, requestId);
    const bgPerm = await Location.getBackgroundPermissionsAsync();
    let granted = bgPerm.granted;
    if (!granted && bgPerm.canAskAgain) {
      const requested = await Location.requestBackgroundPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return false;

    const started = await Location.hasStartedLocationUpdatesAsync(MECHANIC_BG_LOCATION_TASK);
    if (started) return true;

    await Location.startLocationUpdatesAsync(MECHANIC_BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 8_000,
      distanceInterval: 20,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'MontirGo — Perjalanan Aktif',
        notificationBody: 'Lokasi Anda sedang dibagikan ke client selama perjalanan.',
        notificationColor: '#16A34A',
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Hentikan pelacakan lokasi latar belakang saat montir tiba / perjalanan selesai. */
export async function stopBackgroundTripTracking(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_TRIP_REQUEST_KEY).catch(() => {});
  if (Platform.OS === 'web') return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(MECHANIC_BG_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(MECHANIC_BG_LOCATION_TASK);
    }
  } catch {
    // Abaikan error saat native task belum aktif.
  }
}
