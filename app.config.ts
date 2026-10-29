import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Config dinamis agar API key Maps (yang memang publik, tetapi dibatasi per
 * API di Google Cloud) bisa berasal dari `.env.local` tanpa ditulis di repo.
 *
 * Nilai dari `app.json` sudah digabung ke dalam `config` oleh Expo.
 */
const MAPS_API_KEY = process.env.EXPO_PUBLIC_MAPS_API_KEY?.trim();

const LOCATION_PLUGIN: [string, { locationWhenInUsePermission: string }] = [
  'expo-location',
  {
    locationWhenInUsePermission:
      'MontirGo memakai lokasi kamu untuk menampilkan rute dan posisi selama menuju lokasi client.',
  },
];

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];
  const hasLocationPlugin = plugins.some((plugin) =>
    Array.isArray(plugin) ? plugin[0] === 'expo-location' : plugin === 'expo-location',
  );
  if (!hasLocationPlugin) plugins.push(LOCATION_PLUGIN);

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
