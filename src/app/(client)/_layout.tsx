import { Tabs } from 'expo-router';

export default function ClientLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="my-requests" options={{ title: 'Permintaan Saya' }} />
      <Tabs.Screen name="my-vehicles" options={{ title: 'Kendaraan Saya' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      {/* Form di luar tabs — tetap bisa di-push, tapi tidak muncul sebagai tab */}
      <Tabs.Screen name="request/new" options={{ href: null }} />
    </Tabs>
  );
}
