import * as Location from 'expo-location';
import { Platform } from 'react-native';
import {
  DEFAULT_PLATFORM_PRICING,
  getPlatformPricingAndSupport,
  type ClientVehicle,
  type PlatformPricingAndSupport,
} from './service';

export interface PrewarmedLocation {
  lat: number;
  lng: number;
  address: string;
  updatedAt: number;
}

export interface PrewarmedClientData {
  pricing: PlatformPricingAndSupport;
  vehicles: ClientVehicle[];
  location: PrewarmedLocation | null;
  permissionStatus: 'unknown' | 'granted' | 'denied';
}

let state: PrewarmedClientData = {
  pricing: DEFAULT_PLATFORM_PRICING,
  vehicles: [],
  location: null,
  permissionStatus: 'unknown',
};

let inflight: Promise<PrewarmedClientData> | null = null;

export function getPrewarmedClientData(): PrewarmedClientData {
  return state;
}

export function setPrewarmedVehicles(vehicles: ClientVehicle[]): void {
  state = { ...state, vehicles };
}

export function setPrewarmedPricing(pricing: PlatformPricingAndSupport): void {
  state = { ...state, pricing };
}

export function setPrewarmedLocation(location: PrewarmedLocation | null): void {
  state = { ...state, location };
}

/**
 * Lakukan pre-warm tarif biaya panggil dan posisi GPS terakhir yang sudah
 * berizin sejak Beranda Client dimuat (tanpa popup izin paksa).
 */
export async function prewarmClientHome(): Promise<PrewarmedClientData> {
  if (inflight) return inflight;

  inflight = (async () => {
    const [pricingResult, permResult] = await Promise.allSettled([
      getPlatformPricingAndSupport(),
      Location.getForegroundPermissionsAsync(),
    ]);

    let nextPricing = state.pricing;
    if (pricingResult.status === 'fulfilled') {
      nextPricing = pricingResult.value;
    }

    let permissionStatus = state.permissionStatus;
    let nextLocation = state.location;

    if (permResult.status === 'fulfilled') {
      permissionStatus = permResult.value.status === 'granted' ? 'granted' : 'denied';
      if (permissionStatus === 'granted') {
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last?.coords) {
            const { latitude, longitude } = last.coords;
            let resolvedAddress = nextLocation?.address ?? '';
            if (Platform.OS !== 'web' && !resolvedAddress) {
              try {
                const [place] = await Location.reverseGeocodeAsync({
                  latitude,
                  longitude,
                });
                if (place) {
                  resolvedAddress = [place.street, place.district, place.city]
                    .filter(Boolean)
                    .join(', ');
                }
              } catch {
                // Reverse geocode opsional saat pre-warm.
              }
            }
            nextLocation = {
              lat: latitude,
              lng: longitude,
              address: resolvedAddress,
              updatedAt: Date.now(),
            };
          }
        } catch {
          // GPS belum siap; form tetap bisa memicu deteksi ulang.
        }
      }
    }

    state = {
      ...state,
      pricing: nextPricing,
      location: nextLocation,
      permissionStatus,
    };
    return state;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
