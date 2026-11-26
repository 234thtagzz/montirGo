import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Config dinamis agar API key Maps (yang memang publik, tetapi dibatasi per
 * API di Google Cloud) bisa berasal dari `.env.local` tanpa ditulis di repo.
 *
 * Nilai dari `app.json` sudah digabung ke dalam `config` oleh Expo.
 */
const MAPS_API_KEY = process.env.EXPO_PUBLIC_MAPS_API_KEY?.trim();

const LOCATION_PLUGIN: [
  string,
  {
    locationWhenInUsePermission: string;
    locationAlwaysAndWhenInUsePermission: string;
    isAndroidForegroundServiceEnabled: boolean;
    isAndroidBackgroundLocationEnabled: boolean;
  },
] = [
  'expo-location',
  {
    locationWhenInUsePermission:
      'MontirGo memakai lokasi kamu untuk menampilkan rute dan posisi selama menuju lokasi client.',
    locationAlwaysAndWhenInUsePermission:
      'MontirGo memakai lokasi latar belakang saat montir sedang dalam perjalanan menuju client (termasuk saat membuka Google Maps).',
    isAndroidForegroundServiceEnabled: true,
    isAndroidBackgroundLocationEnabled: true,
  },
];

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];
  const hasPlugin = (name: string) =>
    plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] === name : plugin === name));
  if (!hasPlugin('expo-location')) plugins.push(LOCATION_PLUGIN);
  // SDK 58 mewajibkan plugin expo-web-browser, expo-secure-store, dan expo-image terdaftar.
  if (!hasPlugin('expo-web-browser')) plugins.push('expo-web-browser');
  if (!hasPlugin('expo-secure-store')) plugins.push('expo-secure-store');
  if (!hasPlugin('expo-image')) plugins.push('expo-image');

  return {
    ...config,
    name: config.name ?? 'montirGo',
    slug: config.slug ?? 'montirGo',
    ios: {
      ...config.ios,
      bundleIdentifier: config.ios?.bundleIdentifier ?? 'com.montirgo.app',
    },
    android: {
      ...config.android,
      package: config.android?.package ?? 'com.montirgo.app',
      config: {
        ...config.android?.config,
        ...(MAPS_API_KEY
          ? { googleMaps: { apiKey: MAPS_API_KEY } }
          : {}),
      },
    },
    plugins,
  };
};
