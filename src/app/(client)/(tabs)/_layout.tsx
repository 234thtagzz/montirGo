import { Tabs } from 'expo-router';
import { iconColor } from '@/components/ui/icon';
import { TabIcon } from '@/components/ui/tab-icon';
import { useTabBarStyle } from '@/hooks/use-tab-bar-style';
import { useAppTheme } from '@/theme';

export default function ClientTabsLayout() {
  const tabBarStyle = useTabBarStyle();
  const { theme } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.tabActive,
        tabBarInactiveTintColor: theme.colors.tabInactive,
        tabBarStyle,
        tabBarLabelStyle: {
          fontFamily: theme.fontFamily.semibold,
          fontSize: 11,
          marginTop: 1,
        },
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
              color={iconColor(color, theme.colors.tabInactive)}
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
              color={iconColor(color, theme.colors.tabInactive)}
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
              color={iconColor(color, theme.colors.tabInactive)}
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
              color={iconColor(color, theme.colors.tabInactive)}
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
              color={iconColor(color, theme.colors.tabInactive)}
              name="person-outline"
              focusedName="person"
            />
          ),
        }}
      />
    </Tabs>
  );
}
