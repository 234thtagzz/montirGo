import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootIndex() {
  const [target, setTarget] = useState<'/(auth)/login' | '/(client)' | '/(mechanic)' | null>(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        const [token, userStr, role] = await Promise.all([
          AsyncStorage.getItem('montirgo_token'),
          AsyncStorage.getItem('montirgo_user'),
          AsyncStorage.getItem('montirgo_user_role'),
        ]);
        if (!token) {
          setTarget('/(auth)/login');
          return;
        }
        let userRole = role;
        if (!userRole && userStr) {
          try {
            userRole = (JSON.parse(userStr) as { role?: string }).role ?? null;
          } catch {
            userRole = null;
          }
        }
        setTarget(userRole === 'MONTIR' ? '/(mechanic)' : userRole ? '/(client)' : '/(auth)/login');
      } catch {
        setTarget('/(auth)/login');
      }
    };
    resolve();
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={target} />;
}
