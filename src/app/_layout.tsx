import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const colorScheme = useColorScheme();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Baca sesi tersimpan agar splash tidak menutupi redirect.
        // Redirect otomatis per-role ditangani di src/app/index.tsx.
        const userStr = await AsyncStorage.getItem('montirgo_user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr) as { role?: string };
            if (user.role) {
              await AsyncStorage.setItem('montirgo_user_role', user.role);
            }
          } catch {
            // abaikan cache user yang rusak, user tetap ke halaman login
          }
        } else {
          await AsyncStorage.getItem('montirgo_token');
          await AsyncStorage.getItem('montirgo_user_role');
        }
      } finally {
        setIsLoading(false);
        await SplashScreen.hideAsync();
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
        <Text>MontirGo</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(mechanic)" />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});