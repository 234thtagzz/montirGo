import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@/components/ui/icon';
import { LoadingState } from '@/components/ui/state';
import { Brand } from '@/constants/brand';
import { useSessionUser } from '@/hooks/use-session-user';

// Guard: hanya role client (dari database) yang boleh masuk section ini (PRD §6).
export default function ClientLayout() {
  const { user, loading } = useSessionUser();

  if (loading) return <LoadingState message="Memeriksa akses..." />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'MONTIR') return <Redirect href="/(mechanic)" />;
  if (user.role !== 'CLIENT') return <Redirect href="/(auth)/login" />;

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
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-requests"
        options={{
          title: 'Pesanan',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-vehicles"
        options={{
          title: 'Garasi',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'car-sport' : 'car-sport-outline'} size={size} color={color} />
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
        name="services"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="request/new"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="orders/[id]"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
      <Tabs.Screen
        name="vehicles/new"
        options={{ href: null, tabBarStyle: { display: 'none' } }}
      />
    </Tabs>
  );
}
