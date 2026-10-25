import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@/components/ui/icon';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { Brand } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';

// Guard: hanya role montir (dari database) yang boleh masuk section ini (PRD §6).
export default function MechanicLayout() {
  const { user, loading } = useSessionUser();

  if (loading) return <AppLoadingScreen instant status="Memeriksa akses…" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'MONTIR') return <Redirect href="/(client)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: Brand.textMuted,
        tabBarStyle: {
          backgroundColor: Brand.surface,
          borderTopColor: Brand.border,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Request',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'flash' : 'flash-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'AI Asisten',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Aktivitas',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />

      {/* Layar pendalaman — bisa di-push, tidak muncul sebagai tab */}
      <Tabs.Screen
        name="active-orders"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen name="earnings" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="withdraw" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen
        name="payout-accounts"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="active-order/[id]"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="request/[id]"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
    </Tabs>
  );
}
