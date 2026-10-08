import { Tabs } from 'expo-router';

export default function MechanicLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="active-orders" options={{ title: 'Order Aktif' }} />
      <Tabs.Screen name="earnings" options={{ title: 'Pendapatan' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
      {/* Detail order di luar tabs — tetap bisa di-push, tapi tidak muncul sebagai tab */}
      <Tabs.Screen name="active-order/[id]" options={{ href: null }} />
    </Tabs>
  );
}
