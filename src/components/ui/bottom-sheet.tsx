import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  dismissible?: boolean;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const INITIAL_OFFSET = 420;
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 700;

/**
 * Bottom sheet berbasis Reanimated + RNGH v3 dengan gestur tarik ke bawah
 * untuk menutup, scrim backdrop, dan pengamanan safe-area.
 */
export function BottomSheet({
  visible,
  onClose,
  dismissible = true,
  title,
  subtitle,
  children,
  footer,
}: BottomSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) {
    setMounted(true);
  }

  const translateY = useSharedValue(visible ? 0 : INITIAL_OFFSET);
  const backdropOpacity = useSharedValue(visible ? 1 : 0);

  const finishUnmount = useCallback(() => {
    setMounted(false);
  }, []);

  useEffect(() => {
    if (visible) {
      if (reduceMotion) {
        translateY.set(0);
        backdropOpacity.set(1);
      } else {
        translateY.set(INITIAL_OFFSET);
        backdropOpacity.set(0);
        translateY.set(withSpring(0, theme.motion.spring));
        backdropOpacity.set(withTiming(1, { duration: theme.motion.base }));
      }
      return;
    }

    if (!mounted) return;
    if (reduceMotion) {
      translateY.set(INITIAL_OFFSET);
      backdropOpacity.set(0);
      scheduleOnRN(finishUnmount);
      return;
    }

    backdropOpacity.set(withTiming(0, { duration: theme.motion.fast }));
    translateY.set(
      withTiming(INITIAL_OFFSET, { duration: theme.motion.fast }, (finished) => {
        if (finished) {
          scheduleOnRN(finishUnmount);
        }
      }),
    );
  }, [
    backdropOpacity,
    finishUnmount,
    mounted,
    reduceMotion,
    theme.motion.base,
    theme.motion.fast,
    theme.motion.spring,
    translateY,
    visible,
  ]);

  const panGesture = usePanGesture({
    enabled: dismissible && visible,
    activeOffsetY: [-999, 8],
    failOffsetX: [-24, 24],
    onUpdate: (event) => {
      translateY.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      const shouldDismiss =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        scheduleOnRN(onClose);
      } else {
        translateY.set(withSpring(0, theme.motion.spring));
      }
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissible ? onClose : undefined}
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tutup panel"
          disabled={!dismissible}
          onPress={dismissible ? onClose : undefined}
          style={styles.backdropPress}
        >
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.sheet,
              theme.elevation.sheet,
              { paddingBottom: Math.max(insets.bottom, theme.spacing.md) + theme.spacing.md },
              sheetStyle,
            ]}
          >
            <View style={styles.grabber} />
            {title ? (
              <View style={styles.header}>
                <AppText variant="h2" tone="primary">
                  {title}
                </AppText>
                {subtitle ? (
                  <AppText variant="body" tone="secondary" style={styles.subtitle}>
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            <View style={styles.body}>{children}</View>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end' as const,
  },
  backdropPress: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.components.sheet.scrim,
  },
  sheet: {
    backgroundColor: theme.components.sheet.bg,
    borderTopLeftRadius: theme.components.sheet.radius,
    borderTopRightRadius: theme.components.sheet.radius,
    borderCurve: theme.components.sheet.borderCurve,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  grabber: {
    alignSelf: 'center' as const,
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.components.sheet.handleColor,
    marginBottom: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
  },
  body: {
    gap: theme.spacing.sm,
  },
  footer: {
    marginTop: theme.spacing.lg,
  },
});
