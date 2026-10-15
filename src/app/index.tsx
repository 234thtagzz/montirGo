import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getSessionUser } from '@/features/auth/service';

export default function RootIndex() {
  const [target, setTarget] = useState<'/(auth)/login' | '/(client)' | '/(mechanic)' | null>(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        // Role diambil dari tabel profiles (database), bukan dari client.
        const user = await getSessionUser();
        if (!user) {
          setTarget('/(auth)/login');
          return;
        }
        setTarget(user.role === 'MONTIR' ? '/(mechanic)' : '/(client)');
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
