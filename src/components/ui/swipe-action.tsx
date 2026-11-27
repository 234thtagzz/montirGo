import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export type SwipeActionTone = 'primary' | 'emergency' | 'success';

export interface SwipeActionProps {
  label: string;
  completedLabel?: string;
  tone?: SwipeActionTone;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Jarak aman dari tepi layar (px) agar tidak bentrok dengan gestur back Android. */
  edgeInset?: number;
  onConfirm: () => void;
  style?: StyleProp<ViewStyle>;
}

const CONFIRM_THRESHOLD = 0.82;
const TRACK_PADDING = 4;

/**
 * Tombol geser berisiko tinggi (Mulai Perjalanan, Sampai di Lokasi, Terima Tunai).
 * Memiliki edge inset >= 20px dan fallback `accessibilityActions` untuk pembaca layar.
 */
export function SwipeAction({
  label,
  completedLabel = 'Memproses…',
  tone = 'primary',
  icon = 'chevron-forward',
  loading = false,
  disabled = false,
  edgeInset = 20,
  onConfirm,
  style,
}: SwipeActionProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();

  const thumbSize = theme.components.swipeAction.thumbSize;
  const maxTravel = useSharedValue(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const confirmed = useSharedValue(false);

  const isLocked = disabled || loading;

  useEffect(() => {
    if (!loading) {
      confirmed.set(false);
      translateX.set(reduceMotion ? 0 : withSpring(0, theme.motion.spring));
    }
  }, [confirmed, loading, reduceMotion, theme.motion.spring, translateX]);

  const triggerConfirm = useCallback(() => {
    if (!isLocked) {
      onConfirm();
    }
  }, [isLocked, onConfirm]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      const travel = Math.max(0, width - thumbSize - TRACK_PADDING * 2);
      maxTravel.set(travel);
    },
    [maxTravel, thumbSize],
  );

  const panGesture = usePanGesture({
    enabled: !isLocked,
    activeOffsetX: [12, 999],
    failOffsetY: [-18, 18],
    onBegin: () => {
      startX.set(translateX.get());
    },
    onUpdate: (event) => {
      const limit = maxTravel.get();
      if (limit <= 0 || confirmed.get()) return;
      const next = Math.min(limit, Math.max(0, startX.get() + event.translationX));
      translateX.set(next);
    },
    onDeactivate: () => {
      const limit = maxTravel.get();
      if (limit <= 0 || confirmed.get()) return;
      if (translateX.get() >= limit * CONFIRM_THRESHOLD) {
        confirmed.set(true);
        translateX.set(
          reduceMotion ? limit : withTiming(limit, { duration: theme.motion.fast }),
        );
        scheduleOnRN(triggerConfirm);
      } else {
        translateX.set(reduceMotion ? 0 : withSpring(0, theme.motion.spring));
      }
    },
  });

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'activate') {
        triggerConfirm();
      }
    },
    [triggerConfirm],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }));

  const labelStyle = useAnimatedStyle(() => {
    const limit = maxTravel.get();
    const progress = limit > 0 ? translateX.get() / limit : 0;
    return {
      opacity: interpolate(progress, [0, 0.55], [1, 0.15], 'clamp'),
    };
  });

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.get() + thumbSize + TRACK_PADDING * 2,
  }));

  const palette =
    tone === 'emergency'
      ? {
          trackBg: theme.colors.statusEmergencyBg,
          trackBorder: theme.colors.statusEmergencyBorder,
          fillBg: theme.colors.actionEmergencyBg,
          thumbBg: theme.colors.actionEmergencyBg,
          thumbFg: theme.colors.actionEmergencyFg,
          labelColor: theme.colors.statusEmergencyFg,
        }
      : tone === 'success'
        ? {
            trackBg: theme.colors.statusSuccessBg,
            trackBorder: theme.colors.statusSuccessBorder,
            fillBg: theme.colors.statusSuccessFg,
            thumbBg: theme.colors.statusSuccessFg,
            thumbFg: theme.colors.textInverse,
            labelColor: theme.colors.statusSuccessFg,
          }
        : {
            trackBg: theme.colors.bgSurfaceSubtle,
            trackBorder: theme.colors.borderDefault,
            fillBg: theme.colors.actionPrimaryBg,
            thumbBg: theme.colors.actionPrimaryBg,
            thumbFg: theme.colors.actionPrimaryFg,
            labelColor: theme.colors.textPrimary,
          };

  return (
    <View style={[{ paddingHorizontal: edgeInset }, style]}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Geser ke kanan untuk konfirmasi, atau aktifkan lewat aksi aksesibilitas."
        accessibilityState={{ disabled: isLocked, busy: loading }}
        accessibilityActions={[{ name: 'activate', label }]}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={handleLayout}
        style={[
          styles.track,
          {
            backgroundColor: palette.trackBg,
            borderColor: palette.trackBorder,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            { backgroundColor: palette.fillBg },
            fillStyle,
          ]}
        />

        <Animated.View pointerEvents="none" style={[styles.labelWrap, labelStyle]}>
          <AppText variant="label" style={{ color: palette.labelColor }}>
            {loading ? completedLabel : label}
          </AppText>
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.thumb,
              {
                width: thumbSize,
                height: thumbSize,
                backgroundColor: palette.thumbBg,
              },
              thumbStyle,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={palette.thumbFg} />
            ) : (
              <Ionicons name={icon} size={22} color={palette.thumbFg} />
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => ({
  track: {
    height: theme.components.swipeAction.height,
    borderRadius: theme.components.swipeAction.radius,
    borderCurve: theme.components.swipeAction.borderCurve,
    borderWidth: 1,
    padding: TRACK_PADDING,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  fill: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: theme.components.swipeAction.radius,
    opacity: 0.16,
  },
  labelWrap: {
    position: 'absolute' as const,
    left: theme.components.swipeAction.thumbSize + TRACK_PADDING * 2,
    right: theme.spacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  thumb: {
    borderRadius: theme.radii.sm,
    borderCurve: theme.components.swipeAction.borderCurve,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
