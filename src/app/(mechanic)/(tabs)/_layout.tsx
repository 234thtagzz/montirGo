import { Tabs } from 'expo-router';
import { iconColor, Ionicons } from '@/components/ui/icon';
import { TabIcon } from '@/components/ui/tab-icon';
import { Brand } from '@/constants/brand';
import { useTabBarStyle } from '@/hooks/use-tab-bar-style';

export default function MechanicTabsLayout() {
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
        name="requests"
        options={{
          title: 'Request',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={iconColor(color, Brand.textMuted)}
              name="flash-outline"
              focusedName="flash"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'AI Asisten',
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
        name="activity"
        options={{
          title: 'Aktivitas',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={iconColor(color, Brand.textMuted)}
              name="pulse-outline"
              focusedName="pulse"
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
