import { useCallback, useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { SwipeAction } from '@/components/ui/swipe-action';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { TripActions } from './trip-actions';

export type TripPhase = 'preview' | 'enroute' | 'arrived' | 'completed';

interface TripSheetProps {
  clientName: string | null;
  phone: string | null;
  vehicleLabel: string;
  address: string | null;
  etaLabel: string;
  distanceLabel: string;
  arrivalClock: string | null;
  phase: TripPhase;
  isNearDestination: boolean;
  busy: boolean;
  hasLocation: boolean;
  locationError: string | null;
  onPrimary: () => void;
  onWhatsApp: () => void;
  onCall: () => void;
  onOpenMaps: () => void;
  onRetryLocation: () => void;
  onHeightChange?: (height: number) => void;
}

const PRIMARY: Record<TripPhase, { label: string; icon: IconName }> = {
  preview: { label: 'Geser: Mulai Perjalanan', icon: 'navigate-outline' },
  enroute: { label: 'Geser: Sampai di Lokasi', icon: 'location-outline' },
  arrived: { label: 'Susun Estimasi Biaya', icon: 'receipt-outline' },
  completed: { label: 'Buka Detail Order', icon: 'document-text-outline' },
};

const STEPS = ['Diterima', 'Berangkat', 'Tiba', 'Estimasi'] as const;
const SHEET_SPRING = { damping: 24, stiffness: 240, mass: 0.7 };
const FLING_VELOCITY = 600;

function stepState(phase: TripPhase, index: number): 'done' | 'active' | 'next' {
  const activeIndex =
    phase === 'preview' || phase === 'enroute'
      ? 1
      : phase === 'arrived'
        ? 3
        : STEPS.length;
  if (index < activeIndex) return 'done';
  if (index === activeIndex) return 'active';
  return 'next';
}

export function TripSheet({
  clientName,
  phone,
  vehicleLabel,
  address,
  etaLabel,
  distanceLabel,
  arrivalClock,
  phase,
  isNearDestination,
  busy,
  hasLocation,
  locationError,
  onPrimary,
  onWhatsApp,
  onCall,
  onOpenMaps,
  onRetryLocation,
  onHeightChange,
}: TripSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();

  const [collapsed, setCollapsed] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [peekHeight, setPeekHeight] = useState(0);

  const translateY = useSharedValue(0);
  const gestureStartY = useSharedValue(0);

  const primary = PRIMARY[phase];
  const isLive = phase === 'enroute';
  const bottomGap = insets.bottom + theme.spacing.md;
  const collapsedOffset = Math.max(0, sheetHeight - peekHeight - bottomGap);

  const handleSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setSheetHeight((prev) => (prev === next ? prev : next));
  }, []);

  const handlePeekLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setPeekHeight((prev) => (prev === next ? prev : next));
  }, []);

  const panGesture = usePanGesture({
    activeOffsetY: [-8, 8],
    failOffsetX: [-28, 28],
    onBegin: () => {
      gestureStartY.set(translateY.get());
    },
    onUpdate: (event) => {
      const next = gestureStartY.get() + event.translationY;
      translateY.set(Math.min(Math.max(next, 0), collapsedOffset));
    },
    onDeactivate: (event) => {
      let target = 0;
      if (event.velocityY > FLING_VELOCITY) {
        target = collapsedOffset;
      } else if (event.velocityY < -FLING_VELOCITY) {
        target = 0;
      } else {
        target = translateY.get() > collapsedOffset * 0.45 ? collapsedOffset : 0;
      }
      translateY.set(reduceMotion ? target : withSpring(target, SHEET_SPRING));
      scheduleOnRN(setCollapsed, target > 0);
    },
  });

  useEffect(() => {
    const target = collapsed ? collapsedOffset : 0;
    translateY.set(reduceMotion ? target : withSpring(target, SHEET_SPRING));
  }, [collapsed, collapsedOffset, reduceMotion, translateY]);

  const visibleHeight = collapsed ? sheetHeight - collapsedOffset : sheetHeight;
  useEffect(() => {
    if (sheetHeight <= 0) return;
    onHeightChange?.(Math.round(visibleHeight));
  }, [onHeightChange, sheetHeight, visibleHeight]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  return (
    <Animated.View
      onLayout={handleSheetLayout}
      style={[
        styles.sheet,
        theme.elevation.sheet,
        { paddingBottom: bottomGap },
        animatedStyle,
      ]}
    >
      <View onLayout={handlePeekLayout} style={styles.peek}>
        <GestureDetector gesture={panGesture}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              collapsed ? 'Perluas panel perjalanan' : 'Ringkas panel perjalanan'
            }
            accessibilityState={{ expanded: !collapsed }}
            onPress={toggleCollapsed}
            style={styles.dragArea}
          >
            <View style={styles.grabberArea}>
              <View style={styles.grabber} />
              <Ionicons
                name={collapsed ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={theme.colors.textMuted}
              />
            </View>

            <View style={styles.headerRow}>
              <Avatar name={clientName ?? 'Client'} size={42} />
              <View style={styles.headerCopy}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {clientName ?? 'Client MontirGo'}
                </AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={1}>
                  {vehicleLabel || 'Kendaraan tidak dicantumkan'}
                </AppText>
              </View>
              {isLive ? (
                <Badge size="sm" dot tone="success" label="Live" />
              ) : null}
            </View>
          </Pressable>
        </GestureDetector>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <AppText variant="h2" tabular>
              {isLive ? etaLabel : '—'}
            </AppText>
            <AppText variant="caption" tone="muted">
              {isLive ? 'sisa waktu' : 'belum berangkat'}
            </AppText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <AppText variant="h2" tabular>
              {isLive ? distanceLabel : '—'}
            </AppText>
            <AppText variant="caption" tone="muted">
              jarak
            </AppText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <AppText variant="h2" tabular>
              {arrivalClock ?? '—'}
            </AppText>
            <AppText variant="caption" tone="muted">
              perkiraan tiba
            </AppText>
          </View>
        </View>

        {!hasLocation && locationError ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetryLocation}
            style={({ pressed }) => [styles.warning, pressed && styles.pressed]}
          >
            <Ionicons
              name="warning-outline"
              size={16}
              color={theme.colors.statusWarningFg}
            />
            <AppText
              variant="caption"
              style={[styles.warningText, { color: theme.colors.statusWarningFg }]}
            >
              {locationError}
            </AppText>
            <AppText
              variant="label"
              style={{ color: theme.colors.statusWarningFg }}
            >
              Aktifkan
            </AppText>
          </Pressable>
        ) : null}

        {isLive && isNearDestination ? (
          <View style={styles.nearby}>
            <Ionicons
              name="sparkles"
              size={14}
              color={theme.colors.statusSuccessFg}
            />
            <AppText
              variant="label"
              style={{ color: theme.colors.statusSuccessFg }}
            >
              Kamu sudah dekat lokasi client
            </AppText>
          </View>
        ) : null}

        {phase === 'preview' || phase === 'enroute' ? (
          <SwipeAction
            label={primary.label}
            completedLabel={
              phase === 'preview' ? 'Memulai perjalanan…' : 'Mencatat kedatangan…'
            }
            icon={primary.icon}
            tone={phase === 'enroute' ? 'success' : 'primary'}
            edgeInset={20}
            loading={busy}
            onConfirm={onPrimary}
            style={styles.cta}
          />
        ) : (
          <Button
            label={primary.label}
            icon={primary.icon}
            variant="primary"
            size="cta"
            loading={busy}
            onPress={onPrimary}
            style={styles.cta}
          />
        )}
      </View>

      <View
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
        style={collapsed ? styles.hiddenDetails : undefined}
      >
        {address ? (
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={theme.colors.statusInfoFg} />
            <AppText variant="caption" numberOfLines={2} style={styles.address}>
              {address}
            </AppText>
          </View>
        ) : null}

        <View style={styles.steps}>
          {STEPS.map((label, index) => {
            const state = stepState(phase, index);
            return (
              <View key={label} style={styles.step}>
                <View
                  style={[
                    styles.stepDot,
                    state === 'done' && styles.stepDotDone,
                    state === 'active' && styles.stepDotActive,
                  ]}
                >
                  {state === 'done' ? (
                    <Ionicons
                      name="checkmark"
                      size={10}
                      color={theme.colors.actionPrimaryFg}
                    />
                  ) : null}
                </View>
                <AppText
                  variant="caption"
                  tone={state !== 'next' ? 'primary' : 'muted'}
                >
                  {label}
                </AppText>
                {index < STEPS.length - 1 ? (
                  <View
                    style={[
                      styles.stepLine,
                      state === 'done' && styles.stepLineDone,
                    ]}
                  />
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.actionsWrap}>
          <TripActions
            phone={phone}
            onWhatsApp={onWhatsApp}
            onCall={onCall}
            onOpenMaps={onOpenMaps}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const createStyles = (theme: AppTheme) => ({
  sheet: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.bgSurface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.lg,
  },
  peek: {
    paddingTop: theme.spacing.xs,
  },
  dragArea: {
    paddingBottom: theme.spacing.xs,
  },
  grabberArea: {
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.xs,
    gap: 2,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.borderInput,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  metricsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  metric: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.borderSubtle,
  },
  warning: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderWidth: 1,
    borderColor: theme.colors.statusWarningBorder,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  warningText: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  address: {
    flex: 1,
  },
  steps: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.lg,
  },
  step: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    flex: 1,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.colors.borderInput,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepDotDone: {
    backgroundColor: theme.colors.actionPrimaryBg,
    borderColor: theme.colors.actionPrimaryBg,
  },
  stepDotActive: {
    borderColor: theme.colors.actionPrimaryBg,
    backgroundColor: theme.colors.bgSurface,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.borderSubtle,
    marginLeft: 2,
  },
  stepLineDone: {
    backgroundColor: theme.colors.actionPrimaryBg,
  },
  actionsWrap: {
    marginTop: theme.spacing.lg,
  },
  nearby: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.statusSuccessBg,
  },
  cta: {
    marginTop: theme.spacing.md,
  },
  hiddenDetails: {
    pointerEvents: 'none' as const,
  },
  pressed: {
    opacity: 0.75,
  },
});
