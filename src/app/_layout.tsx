import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { supabase } from '@/lib/supabase';

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
  const colorScheme = useColorScheme();

  // Splash native baru dilepas setelah splash animasi benar-benar tergambar,
  // sehingga tidak ada kedipan layar kosong di antaranya.
  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const boot = async () => {
      try {
        // Pulihkan sesi Supabase (persisted di AsyncStorage oleh supabase-js).
        // Redirect otomatis per-role ditangani di src/app/index.tsx.
        await supabase.auth.getSession();
      } catch {
        // Gagal restore sesi tidak boleh menahan aplikasi; index.tsx akan redirect ke login.
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

    boot();

    return () => {
      cancelled = true;
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, []);

  if (isBooting) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <AppLoadingScreen exiting={isExiting} onLayout={hideNativeSplash} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(client)" />
          <Stack.Screen name="(mechanic)" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
