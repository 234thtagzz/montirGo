import { Redirect, Tabs } from 'expo-router';
import { useSessionUser } from '@/hooks/use-session-user';
import { LoadingState } from '@/components/ui/state';

// Guard: hanya role montir (dari database) yang boleh masuk section ini (PRD §6).
export default function MechanicLayout() {
  const { user, loading } = useSessionUser();

  if (loading) return <LoadingState message="Memeriksa akses..." />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== 'MONTIR') return <Redirect href="/(client)" />;

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="requests" options={{ title: 'Request' }} />
      <Tabs.Screen name="ai-assistant" options={{ title: 'AI Asisten' }} />
      <Tabs.Screen name="activity" options={{ title: 'Aktivitas' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      {/* Layar pendalaman — di-push, tidak muncul sebagai tab */}
      <Tabs.Screen name="active-orders" options={{ href: null }} />
      <Tabs.Screen name="earnings" options={{ href: null }} />
      <Tabs.Screen name="active-order/[id]" options={{ href: null }} />
    </Tabs>
  );
}
