import { Tabs } from 'expo-router';
import { iconColor } from '@/components/ui/icon';
import { TabIcon } from '@/components/ui/tab-icon';
import { useTabBarStyle } from '@/hooks/use-tab-bar-style';
import { useAppTheme } from '@/theme';

export default function MechanicTabsLayout() {
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
        name="requests"
        options={{
          title: 'Request',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={iconColor(color, theme.colors.tabInactive)}
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
              color={iconColor(color, theme.colors.tabInactive)}
              name="git-compare-outline"
              focusedName="git-compare"
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
              color={iconColor(color, theme.colors.tabInactive)}
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
