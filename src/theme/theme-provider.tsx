import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider, type Theme as NavigationTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type AppTheme, type ThemeMode } from '@/theme/tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@montirgo/theme_preference';

interface AppThemeContextValue {
  readonly theme: AppTheme;
  readonly mode: ThemeMode;
  readonly isDark: boolean;
  readonly preference: ThemePreference;
  readonly hydrated: boolean;
  readonly setPreference: (next: ThemePreference) => void;
  readonly navigationTheme: NavigationTheme;
}

function buildNavigationTheme(theme: AppTheme): NavigationTheme {
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.isDark,
    colors: {
      ...base.colors,
      primary: theme.colors.actionPrimaryBg,
      background: theme.colors.bgCanvas,
      card: theme.colors.bgSurface,
      text: theme.colors.textPrimary,
      border: theme.colors.borderSubtle,
      notification: theme.colors.actionEmergencyBg,
    },
  };
}

const LIGHT_NAV_THEME = buildNavigationTheme(lightTheme);
const DARK_NAV_THEME = buildNavigationTheme(darkTheme);

const AppThemeContext = createContext<AppThemeContextValue>({
  theme: lightTheme,
  mode: 'light',
  isDark: false,
  preference: 'system',
  hydrated: false,
  setPreference: () => {},
  navigationTheme: LIGHT_NAV_THEME,
});

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && isThemePreference(stored)) {
          setPreferenceState(stored);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const mode: ThemeMode =
    preference === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : preference;

  const theme = mode === 'dark' ? darkTheme : lightTheme;
  const navigationTheme = mode === 'dark' ? DARK_NAV_THEME : LIGHT_NAV_THEME;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.bgCanvas).catch(() => {});
    if (Platform.OS !== 'web') {
      try {
        Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
      } catch {
        // Beberapa runtime web/test tidak mengimplementasikan override native.
      }
    }
  }, [preference, theme.colors.bgCanvas]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      theme,
      mode,
      isDark: mode === 'dark',
      preference,
      hydrated,
      setPreference,
      navigationTheme,
    }),
    [hydrated, mode, navigationTheme, preference, setPreference, theme],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  return useContext(AppThemeContext);
}
