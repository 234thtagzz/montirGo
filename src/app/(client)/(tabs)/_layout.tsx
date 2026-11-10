import { iconColor } from '@/components/ui/icon';
import { TabIcon } from '@/components/ui/tab-icon';
import { Brand } from '@/constants/brand';
import { useTabBarStyle } from '@/hooks/use-tab-bar-style';
import { Tabs } from 'expo-router';

export default function ClientTabsLayout() {
  const tabBarStyle = useTabBarStyle();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: Brand.textMuted,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={iconColor(color, Brand.textMuted)}
              name="grid-outline"
              focusedName="grid"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="my-requests"
        options={{
          title: 'Pesanan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={iconColor(color, Brand.textMuted)}
              name="receipt-outline"
              focusedName="receipt"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="my-vehicles"
        options={{
          title: 'Garasi',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={iconColor(color, Brand.textMuted)}
              name="car-sport-outline"
              focusedName="car-sport"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'Tanya AI',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={iconColor(color, Brand.textMuted)}
              name="sparkles-outline"
              focusedName="sparkles"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={iconColor(color, Brand.textMuted)}
              name="person-outline"
              focusedName="person"
            />
          ),
        }}
      />
    </Tabs>
  );
}
