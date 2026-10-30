import { iconColor, Ionicons } from "@/components/ui/icon";
import { Brand } from "@/constants/brand";
import { useTabBarStyle } from "@/hooks/use-tab-bar-style";
import { Tabs } from "expo-router";

export default function ClientTabsLayout() {
  const tabBarStyle = useTabBarStyle();

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
              color={iconColor(color, Brand.textMuted)}
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
              color={iconColor(color, Brand.textMuted)}
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
              color={iconColor(color, Brand.textMuted)}
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
              color={iconColor(color, Brand.textMuted)}
            />
          ),
        }}
      />
    </Tabs>
  );
}
