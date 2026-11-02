import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Ionicons } from '@/components/ui/icon';
import { Brand, CardShadow, Radius, Space } from '@/constants/brand';

interface ClientTripSheetProps {
  mechanicName: string | null;
  mechanicAvatar: string | null;
  phone: string | null;
  address: string | null;
  etaLabel: string;
  distanceLabel: string;
  arrivalClock: string | null;
  /** true = belum ada sinyal GPS montir. */
  waiting: boolean;
  /** true = titik terakhir sudah lebih dari ±45 detik. */
  stale: boolean;
  onWhatsApp: () => void;
  onCall: () => void;
  onOpenDetail: () => void;
  /** Tinggi sheet yang terlihat (ikut berubah saat dilipat) — untuk padding peta. */
  onHeightChange?: (height: number) => void;
}

const STEPS = ['Diterima', 'Berangkat', 'Tiba', 'Tagihan'] as const;
/** Di layar client, perjalanan selalu berada di langkah "Berangkat". */
const ACTIVE_STEP = 1;

/** Pegas snap saat sheet dilepas / diketuk. */
const SHEET_SPRING = { damping: 24, stiffness: 240, mass: 0.7 };
/** Ambang kecepatan (px/detik) untuk menentukan arah lipat saat jari dilepas. */
const FLING_VELOCITY = 600;

function stepState(index: number): 'done' | 'active' | 'next' {
  if (index < ACTIVE_STEP) return 'done';
  if (index === ACTIVE_STEP) return 'active';
  return 'next';
}

/**
 * Kartu bawah layar perjalanan versi client.
 *
 * Struktur & gesturnya sama dengan `TripSheet` milik montir (bisa dilipat), isinya
 * disesuaikan: identitas montir, ETA/jarak/jam tiba, dan aksi chat/telepon.
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
  const insets = useSafeAreaInsets();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [peekHeight, setPeekHeight] = useState(0);

  const translateY = useSharedValue(0);
  const gestureStartY = useSharedValue(0);

  const isLive = !waiting;
  const bottomGap = insets.bottom + Space.md;
  const collapsedOffset = Math.max(0, sheetHeight - peekHeight - bottomGap);
  const chipLabel = waiting ? 'Menunggu' : stale ? 'Terakhir' : 'Live';

  const handleSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setSheetHeight((prev) => (prev === next ? prev : next));
  }, []);

  const handlePeekLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setPeekHeight((prev) => (prev === next ? prev : next));
  }, []);

  // Sama seperti sheet montir: geser/ketuk grabber untuk melipat.
  const panGesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-28, 28])
    .onStart(() => {
      gestureStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = gestureStartY.value + event.translationY;
      translateY.value = Math.min(Math.max(next, 0), collapsedOffset);
    })
    .onEnd((event) => {
      let target = 0;
      if (event.velocityY > FLING_VELOCITY) {
        target = collapsedOffset;
      } else if (event.velocityY < -FLING_VELOCITY) {
        target = 0;
      } else {
        target = translateY.value > collapsedOffset * 0.45 ? collapsedOffset : 0;
      }
      translateY.value = withSpring(target, SHEET_SPRING);
      runOnJS(setCollapsed)(target > 0);
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(500)
    .onEnd(() => {
      const target = translateY.value > collapsedOffset / 2 ? 0 : collapsedOffset;
      translateY.value = withSpring(target, SHEET_SPRING);
      runOnJS(setCollapsed)(target > 0);
    });

  const dragGesture = Gesture.Race(panGesture, tapGesture);

  useEffect(() => {
    translateY.value = withSpring(collapsed ? collapsedOffset : 0, SHEET_SPRING);
    // `translateY` adalah shared value stabil, aman tidak dimasukkan sebagai dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, collapsedOffset]);

  const visibleHeight = collapsed ? sheetHeight - collapsedOffset : sheetHeight;
  useEffect(() => {
    if (sheetHeight <= 0) return;
    onHeightChange?.(Math.round(visibleHeight));
  }, [onHeightChange, sheetHeight, visibleHeight]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      onLayout={handleSheetLayout}
      style={[styles.sheet, { paddingBottom: bottomGap }, animatedStyle]}
    >
      <View onLayout={handlePeekLayout} style={styles.peek}>
        <GestureDetector gesture={dragGesture}>
          <View style={styles.dragArea}>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                collapsed ? 'Perluas panel perjalanan' : 'Ringkas panel perjalanan'
              }
              accessibilityHint="Geser ke bawah untuk meringkas, ke atas untuk memperluas"
              accessibilityState={{ expanded: !collapsed }}
              onAccessibilityTap={toggleCollapsed}
              style={styles.grabberArea}
            >
              <View style={styles.grabber} />
              <Ionicons
                name={collapsed ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={Brand.textMuted}
              />
            </View>

            <View style={styles.headerRow}>
              <Avatar name={mechanicName ?? 'Montir'} uri={mechanicAvatar} size={42} />
              <View style={styles.headerCopy}>
                <Text numberOfLines={1} style={styles.name}>
                  {mechanicName ?? 'Montir MontirGo'}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  Montir yang menuju lokasimu
                </Text>
              </View>
              <View
                style={[
                  styles.liveChip,
                  (waiting || stale) && styles.liveChipMuted,
                ]}
              >
                <View
                  style={[
                    styles.liveDot,
                    (waiting || stale) && styles.liveDotMuted,
                  ]}
                />
                <Text
                  style={[
                    styles.liveText,
                    (waiting || stale) && styles.liveTextMuted,
                  ]}
                >
                  {chipLabel}
                </Text>
              </View>
            </View>
          </View>
        </GestureDetector>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{isLive ? etaLabel : '—'}</Text>
            <Text style={styles.metricLabel}>{isLive ? 'sisa waktu' : 'menunggu posisi'}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{isLive ? distanceLabel : '—'}</Text>
            <Text style={styles.metricLabel}>jarak</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{arrivalClock ?? '—'}</Text>
            <Text style={styles.metricLabel}>perkiraan tiba</Text>
          </View>
        </View>

        {waiting ? (
          <View style={styles.notice}>
            <Ionicons name="navigate-outline" size={16} color={Brand.amber} />
            <Text style={styles.noticeText}>
              Menunggu sinyal GPS montir. Posisi muncul otomatis saat montir bergerak.
            </Text>
          </View>
        ) : null}

        <Button
          label="Chat Montir"
          icon="logo-whatsapp"
          disabled={!phone}
          onPress={onWhatsApp}
          style={styles.cta}
        />
      </View>

      {/* Detail — ikut tergeser ke bawah layar saat sheet dilipat. */}
      <View
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
        style={collapsed ? styles.hiddenDetails : undefined}
      >
        {address ? (
          <View style={styles.addressRow}>
            <Ionicons name="home" size={16} color={Brand.primary} />
            <Text numberOfLines={2} style={styles.address}>
              {address}
            </Text>
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
                    <Ionicons name="checkmark" size={10} color={Brand.white} />
                  ) : null}
                </View>
                <Text style={[styles.stepLabel, state !== 'next' && styles.stepLabelActive]}>
                  {label}
                </Text>
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
            <View style={[styles.iconWrap, { backgroundColor: Brand.primarySoft }]}>
              <Ionicons name="call" size={19} color={Brand.primary} />
            </View>
            <Text style={styles.actionLabel}>Telepon</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buka detail pesanan"
            onPress={onOpenDetail}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#F3F6FA' }]}>
              <Ionicons name="document-text-outline" size={19} color={Brand.textSecondary} />
            </View>
            <Text style={styles.actionLabel}>Detail pesanan</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Brand.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Space.lg,
    ...CardShadow,
  },
  peek: { paddingTop: Space.xs },
  dragArea: { paddingBottom: 6 },
  grabberArea: { alignItems: 'center', paddingVertical: 6, gap: 2 },
  grabber: { width: 42, height: 4, borderRadius: 2, backgroundColor: Brand.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, marginTop: 2 },
  headerCopy: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: Brand.text },
  meta: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Brand.greenSoft,
  },
  liveChipMuted: { backgroundColor: Brand.amberSoft },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.green },
  liveDotMuted: { backgroundColor: Brand.amber },
  liveText: { fontSize: 10, fontWeight: '700', color: Brand.green },
  liveTextMuted: { color: Brand.amber },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.sm,
    paddingVertical: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.divider,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 17, fontWeight: '700', color: Brand.text },
  metricLabel: { fontSize: 10, color: Brand.textMuted, marginTop: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: Brand.divider },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.md,
  },
  noticeText: { flex: 1, fontSize: 11, color: Brand.amber, lineHeight: 16 },
  cta: { marginTop: Space.md, minHeight: 52 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm, marginTop: Space.md },
  address: { flex: 1, fontSize: 12.5, color: Brand.text, lineHeight: 18 },
  steps: { flexDirection: 'row', alignItems: 'center', marginTop: Space.lg },
  step: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  stepDotActive: { borderColor: Brand.primary, backgroundColor: Brand.white },
  stepLabel: { fontSize: 10.5, fontWeight: '600', color: Brand.textMuted },
  stepLabelActive: { color: Brand.text },
  stepLine: { flex: 1, height: 2, backgroundColor: Brand.divider, marginLeft: 2 },
  stepLineDone: { backgroundColor: Brand.primary },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', gap: Space.md, marginTop: Space.lg },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  actionDisabled: { opacity: 0.4 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 11, fontWeight: '600', color: Brand.textSecondary },
  hiddenDetails: { pointerEvents: 'none' },
  pressed: { opacity: 0.7 },
});
