import { AppLoadingScreen } from "@/components/app-loading-screen";
import { Ionicons } from "@/components/ui/icon";
import { Brand } from "@/constants/brand";
import { useSessionUser } from "@/hooks/use-session-user";
import { useTabBarStyle } from "@/hooks/use-tab-bar-style";
import { Redirect, Tabs } from "expo-router";

// Guard: hanya role client (dari database) yang boleh masuk section ini (PRD §6).
export default function ClientLayout() {
  const { user, loading } = useSessionUser();
  const tabBarStyle = useTabBarStyle();

  if (loading) return <AppLoadingScreen instant status="Memeriksa akses…" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === "MONTIR") return <Redirect href="/(mechanic)" />;
  if (user.role !== "CLIENT") return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: Brand.textMuted,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Beranda",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="my-requests"
        options={{
          title: "Pesanan",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "receipt" : "receipt-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="my-vehicles"
        options={{
          title: "Garasi",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "car-sport" : "car-sport-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* Layar pendalaman — bisa di-push, tidak muncul sebagai tab */}
      <Tabs.Screen
        name="services"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="request/new"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="orders/[id]"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
      <Tabs.Screen
        name="vehicles/new"
        options={{ href: null, tabBarStyle: { display: "none" } }}
      />
    </Tabs>
  );
}
