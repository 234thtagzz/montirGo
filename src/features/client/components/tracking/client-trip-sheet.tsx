import { useCallback, useEffect, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';

interface ClientTripSheetProps {
  mechanicName: string | null;
  mechanicAvatar: string | null;
  phone: string | null;
  address: string | null;
  etaLabel: string;
  distanceLabel: string;
  arrivalClock: string | null;
  waiting: boolean;
  stale: boolean;
  onWhatsApp: () => void;
  onCall: () => void;
  onOpenDetail: () => void;
  onHeightChange?: (height: number) => void;
}

const STEPS = ['Diterima', 'Berangkat', 'Tiba', 'Tagihan'] as const;
const ACTIVE_STEP = 1;
const FLING_VELOCITY = 600;

function stepState(index: number): 'done' | 'active' | 'next' {
  if (index < ACTIVE_STEP) return 'done';
  if (index === ACTIVE_STEP) return 'active';
  return 'next';
}

/**
 * Kartu bawah layar perjalanan client (Reanimated 4 + RNGH v3 + semantic tokens).
 */
export function ClientTripSheet({
  mechanicName,
  mechanicAvatar,
  phone,
  address,
  etaLabel,
  distanceLabel,
  arrivalClock,
  waiting,
  stale,
  onWhatsApp,
  onCall,
  onOpenDetail,
  onHeightChange,
}: ClientTripSheetProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const [collapsed, setCollapsed] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [peekHeight, setPeekHeight] = useState(0);

  const translateY = useSharedValue(0);
  const gestureStartY = useSharedValue(0);

  const isLive = !waiting;
  const bottomGap = insets.bottom + theme.spacing.md;
  const collapsedOffset = Math.max(0, sheetHeight - peekHeight - bottomGap);
  const chipLabel = waiting ? 'Menunggu' : stale ? 'Terakhir' : 'Live';
  const chipTone = waiting || stale ? 'warning' : 'success';

  const handleSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setSheetHeight((prev) => (prev === next ? prev : next));
  }, []);

  const handlePeekLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setPeekHeight((prev) => (prev === next ? prev : next));
  }, []);

  const panGesture = usePanGesture({
    activeOffsetY: [-6, 6],
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
      translateY.set(reduceMotion ? target : withSpring(target, theme.motion.spring));
      scheduleOnRN(setCollapsed, target > 0);
    },
  });

  useEffect(() => {
    const target = collapsed ? collapsedOffset : 0;
    translateY.set(reduceMotion ? target : withSpring(target, theme.motion.spring));
  }, [collapsed, collapsedOffset, reduceMotion, theme.motion.spring, translateY]);

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
      style={[styles.sheet, theme.elevation.sheet, { paddingBottom: bottomGap }, animatedStyle]}
    >
      <View onLayout={handlePeekLayout} style={styles.peek}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.dragArea}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                collapsed ? 'Perluas panel perjalanan' : 'Ringkas panel perjalanan'
              }
              accessibilityHint="Ketuk atau geser ke bawah untuk meringkas, ke atas untuk memperluas"
              accessibilityState={{ expanded: !collapsed }}
              onPress={toggleCollapsed}
              style={styles.grabberArea}
            >
              <View style={styles.grabber} />
              <Ionicons
                name={collapsed ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={theme.colors.textMuted}
              />
            </Pressable>

            <View style={styles.headerRow}>
              <Avatar name={mechanicName ?? 'Montir'} uri={mechanicAvatar} size={44} />
              <View style={styles.headerCopy}>
                <AppText variant="overline" tone="muted">
                  MONTIRMU
                </AppText>
                <AppText variant="title" numberOfLines={1}>
                  {mechanicName ?? 'Montir MontirGo'}
                </AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={1}>
                  Menuju lokasimu
                </AppText>
              </View>
              <Badge label={chipLabel} tone={chipTone} dot size="sm" />
            </View>
          </View>
        </GestureDetector>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <AppText variant="title" style={theme.tabularNums}>
              {isLive ? etaLabel : '—'}
            </AppText>
            <AppText variant="caption" tone="muted">
              {isLive ? 'sisa waktu' : 'menunggu posisi'}
            </AppText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <AppText variant="title" style={theme.tabularNums}>
              {isLive ? distanceLabel : '—'}
            </AppText>
            <AppText variant="caption" tone="muted">
              jarak
            </AppText>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <AppText variant="title" style={theme.tabularNums}>
              {arrivalClock ?? '—'}
            </AppText>
            <AppText variant="caption" tone="muted">
              perkiraan tiba
            </AppText>
          </View>
        </View>

        {waiting ? (
          <View style={styles.notice}>
            <Ionicons name="navigate-outline" size={16} color={theme.colors.statusWarningFg} />
            <AppText variant="caption" tone="warning" style={styles.flexCopy}>
              Menunggu sinyal GPS montir. Posisi muncul otomatis saat montir bergerak.
            </AppText>
          </View>
        ) : null}

        <Button
          label="Chat Montir"
          icon="logo-whatsapp"
          variant="whatsapp"
          size="cta"
          disabled={!phone}
          onPress={onWhatsApp}
          style={styles.cta}
        />
      </View>

      <View
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
        style={collapsed ? styles.hiddenDetails : undefined}
      >
        {address ? (
          <View style={styles.addressRow}>
            <Ionicons name="home" size={16} color={theme.colors.statusInfoFg} />
            <AppText variant="caption" numberOfLines={2} style={styles.flexCopy}>
              {address}
            </AppText>
          </View>
        ) : null}

        <View style={styles.steps}>
          {STEPS.map((label, index) => {
            const state = stepState(index);
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
                    <Ionicons name="checkmark" size={10} color={theme.colors.actionPrimaryFg} />
                  ) : null}
                </View>
                <AppText
                  variant="caption"
                  tone={state !== 'next' ? 'primary' : 'muted'}
                >
                  {label}
                </AppText>
                {index < STEPS.length - 1 ? (
                  <View style={[styles.stepLine, state === 'done' && styles.stepLineDone]} />
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Telepon montir"
            accessibilityState={{ disabled: !phone }}
            disabled={!phone}
            onPress={onCall}
            style={({ pressed }) => [
              styles.action,
              !phone && styles.actionDisabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.statusInfoBg }]}>
              <Ionicons name="call" size={20} color={theme.colors.statusInfoFg} />
            </View>
            <AppText variant="caption" tone="secondary">
              Telepon
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka detail pesanan"
            onPress={onOpenDetail}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.bgSurfaceSubtle }]}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
            </View>
            <AppText variant="caption" tone="secondary">
              Detail pesanan
            </AppText>
          </Pressable>
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
    borderTopLeftRadius: theme.components.sheet.radius,
    borderTopRightRadius: theme.components.sheet.radius,
    borderTopWidth: 1,
    borderColor: theme.colors.borderSubtle,
    paddingHorizontal: theme.spacing.screenPadding,
  },
  peek: { paddingTop: theme.spacing.xs },
  dragArea: { paddingBottom: theme.spacing.xs },
  grabberArea: {
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.xs,
    gap: 2,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.components.sheet.handleColor,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: 2,
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
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
    gap: theme.spacing.xxs,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.borderSubtle,
  },
  notice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  flexCopy: { flex: 1 },
  cta: { marginTop: theme.spacing.md },
  addressRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  steps: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.lg,
  },
  step: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    flex: 1,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.colors.borderDefault,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepDotDone: {
    backgroundColor: theme.colors.actionPrimaryAltBg,
    borderColor: theme.colors.actionPrimaryAltBg,
  },
  stepDotActive: {
    borderColor: theme.colors.actionPrimaryAltBg,
    backgroundColor: theme.colors.bgSurface,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.borderSubtle,
    marginLeft: 2,
  },
  stepLineDone: {
    backgroundColor: theme.colors.actionPrimaryAltBg,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  action: {
    flex: 1,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    minHeight: theme.touchTarget.min,
  },
  actionDisabled: { opacity: 0.4 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  hiddenDetails: { pointerEvents: 'none' as const },
  pressed: { opacity: 0.75 },
});
