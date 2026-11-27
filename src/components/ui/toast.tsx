import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme, type SemanticTone } from '@/theme';

export interface ToastOptions {
  title?: string;
  message: string;
  tone?: SemanticTone;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  dismissToast: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  dismissToast: () => {},
});

const TONE_ICON: Record<SemanticTone, IconName> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
  neutral: 'notifications',
  emergency: 'flash',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearTimer();
    if (reduceMotion) {
      progress.set(0);
      setToast(null);
      return;
    }
    progress.set(withTiming(0, { duration: theme.motion.fast }));
    timerRef.current = setTimeout(() => {
      setToast(null);
    }, theme.motion.fast);
  }, [clearTimer, progress, reduceMotion, theme.motion.fast]);

  const showToast = useCallback(
    (options: ToastOptions) => {
      clearTimer();
      const id = Date.now();
      setToast({ ...options, id });
      if (reduceMotion) {
        progress.set(1);
      } else {
        progress.set(0);
        progress.set(withTiming(1, { duration: theme.motion.base }));
      }
      const duration = options.durationMs ?? 3600;
      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          dismissToast();
        }, duration);
      }
    },
    [clearTimer, dismissToast, progress, reduceMotion, theme.motion.base],
  );

  useEffect(() => () => clearTimer(), [clearTimer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * -18 }],
  }));

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast],
  );

  const tone: SemanticTone = toast?.tone ?? 'info';
  const palette = theme.tones[tone];

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          style={[styles.portal, { top: insets.top + theme.spacing.sm }]}
        >
          <Animated.View
            accessibilityLiveRegion="polite"
            style={[
              styles.banner,
              theme.elevation.sheet,
              {
                backgroundColor: palette.bg,
                borderColor: palette.border,
              },
              animatedStyle,
            ]}
          >
            <Ionicons name={TONE_ICON[tone]} size={20} color={palette.fg} />
            <View style={styles.copy}>
              {toast.title ? (
                <AppText variant="label" style={{ color: palette.fg }}>
                  {toast.title}
                </AppText>
              ) : null}
              <AppText variant="caption" style={{ color: palette.fg }}>
                {toast.message}
              </AppText>
            </View>
            {toast.actionLabel && toast.onAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={toast.actionLabel}
                onPress={() => {
                  const cb = toast.onAction;
                  dismissToast();
                  cb?.();
                }}
                hitSlop={8}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <AppText variant="label" style={{ color: palette.fg }}>
                  {toast.actionLabel}
                </AppText>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup notifikasi"
              onPress={dismissToast}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={18} color={palette.fg} />
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const createStyles = (theme: AppTheme) => ({
  portal: {
    position: 'absolute' as const,
    left: theme.spacing.screenPadding,
    right: theme.spacing.screenPadding,
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: theme.components.card.borderCurve,
    borderWidth: 1,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  actionBtn: {
    minHeight: theme.touchTarget.min,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pressed: {
    opacity: 0.7,
  },
});
