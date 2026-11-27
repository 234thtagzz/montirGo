import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import * as Font from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { ToastProvider } from '@/components/ui/toast';
import { startAppLifecycle } from '@/lib/app-lifecycle';
import { supabase } from '@/lib/supabase';
import { AppThemeProvider } from '@/theme';
// Daftarkan background location task di module scope sebelum navigasi berjalan.
import '@/features/mechanic/tracking/background-location';

SplashScreen.preventAutoHideAsync();

/** Minimal durasi layar loading brand agar animasinya sempat tampil. */
const MIN_BOOT_MS = 1200;
/** Samakan dengan durasi animasi keluar AppLoadingScreen. */
const EXIT_MS = 340;

if (Platform.OS !== 'web') {
  // Transisi lembut dari splash native ke splash animasi MontirGo.
  SplashScreen.setOptions({ duration: 300, fade: true });
}

export default function RootLayout() {
  const [isBooting, setIsBooting] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Splash native baru dilepas setelah splash animasi benar-benar tergambar,
  // sehingga tidak ada kedipan layar kosong di antaranya.
  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // AppState + listener auth dipasang sekali untuk seluruh aplikasi.
  useEffect(() => startAppLifecycle(), []);

  useEffect(() => {
    let cancelled = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const boot = async () => {
      try {
        await Promise.all([
          Font.loadAsync({
            PlusJakartaSans_400Regular,
            PlusJakartaSans_500Medium,
            PlusJakartaSans_600SemiBold,
            PlusJakartaSans_700Bold,
            PlusJakartaSans_800ExtraBold,
          }).catch(() => {}),
          Promise.race([
            supabase.auth.getSession(),
            new Promise((resolve) => setTimeout(resolve, 1500)),
          ]).catch(() => {}),
        ]);
      } catch {
        // Gagal restore sesi atau font tidak boleh menahan aplikasi.
      }

      const remaining = MIN_BOOT_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      if (cancelled) return;

      setIsExiting(true);
      exitTimer = setTimeout(() => {
        if (!cancelled) setIsBooting(false);
      }, EXIT_MS);
    };

    void boot();

    return () => {
      cancelled = true;
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppThemeProvider>
        <ToastProvider>
          {isBooting ? (
            <AppLoadingScreen exiting={isExiting} onLayout={hideNativeSplash} />
          ) : (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(client)" />
              <Stack.Screen name="(mechanic)" />
            </Stack>
          )}
        </ToastProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
