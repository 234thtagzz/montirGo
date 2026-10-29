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
import type { IconName } from '@/components/ui/icon';
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
  /** Tinggi sheet yang *terlihat* (ikut berubah saat dilipat) — untuk padding peta. */
  onHeightChange?: (height: number) => void;
}

const PRIMARY: Record<TripPhase, { label: string; icon: IconName }> = {
  preview: { label: 'Mulai Perjalanan', icon: 'navigate-outline' },
  enroute: { label: 'Sampai di Lokasi', icon: 'location-outline' },
  arrived: { label: 'Buka Detail Order', icon: 'document-text-outline' },
  completed: { label: 'Buka Detail Order', icon: 'document-text-outline' },
};

const STEPS = ['Diterima', 'Berangkat', 'Tiba'] as const;

/** Pegas snap saat sheet dilepas / diketuk. */
const SHEET_SPRING = { damping: 24, stiffness: 240, mass: 0.7 };

/** Ambang kecepatan (px/detik) untuk menentukan arah lipat saat jari dilepas. */
const FLING_VELOCITY = 600;

function stepState(phase: TripPhase, index: number): 'done' | 'active' | 'next' {
  const activeIndex = phase === 'preview' ? 1 : phase === 'enroute' ? 1 : 2;
  if (index < activeIndex) return 'done';
  if (index === activeIndex) return 'active';
  return 'next';
}

/**
 * Kartu bawah layar perjalanan.
 *
 * Bisa **dilipat ke bawah** (minimize) dengan menggeser area grabber/header ke
 * bawah, atau dengan mengetuknya. Saat terlipat hanya bagian penting yang
 * terlihat: nama client, ETA/jarak/jam tiba, peringatan GPS, dan tombol aksi
 * utama. Detail (alamat, langkah status, tombol WhatsApp/telepon/rute) terdorong
 * ke bawah layar dan kembali muncul saat sheet ditarik naik.
 */
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
  const [collapsed, setCollapsed] = useState(false);
  /** Tinggi total sheet (tanpa transform). */
  const [sheetHeight, setSheetHeight] = useState(0);
  /** Tinggi bagian yang tetap terlihat saat terlipat (grabber → tombol utama). */
  const [peekHeight, setPeekHeight] = useState(0);

  const translateY = useSharedValue(0);
  const gestureStartY = useSharedValue(0);

  const primary = PRIMARY[phase];
  const isLive = phase === 'enroute';
  const bottomGap = insets.bottom + Space.md;
  const collapsedOffset = Math.max(0, sheetHeight - peekHeight - bottomGap);

  const handleSheetLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setSheetHeight((prev) => (prev === next ? prev : next));
  }, []);

  const handlePeekLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    setPeekHeight((prev) => (prev === next ? prev : next));
  }, []);

  // Gestur digeser sebelum `useEffect`/`useAnimatedStyle` agar React Compiler
  // tidak menganggap shared value dimodifikasi setelah dibaca hook lain.
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
        // Kurang dari setengah jalan → kembali; lebih dari setengah → lipat.
        target = translateY.value > collapsedOffset * 0.45 ? collapsedOffset : 0;
      }
      translateY.value = withSpring(target, SHEET_SPRING);
      runOnJS(setCollapsed)(target > 0);
    });

  // Ketukan singkat (tanpa geser) melipat/membuka sheet — cadangan yang ramah
  // untuk pengguna yang sulit melakukan drag presisi.
  const tapGesture = Gesture.Tap()
    .maxDuration(500)
    .onEnd(() => {
      const target = translateY.value > collapsedOffset / 2 ? 0 : collapsedOffset;
      translateY.value = withSpring(target, SHEET_SPRING);
      runOnJS(setCollapsed)(target > 0);
    });

  const dragGesture = Gesture.Race(panGesture, tapGesture);

  // Satu sumber kebenaran: `collapsed` menentukan posisi sheet. Dipakai saat
  // diketuk (a11y), saat chip peringatan muncul/hilang, dan saat sheet berubah
  // tinggi karena datanya berubah.
  useEffect(() => {
    translateY.value = withSpring(collapsed ? collapsedOffset : 0, SHEET_SPRING);
    // `translateY` adalah shared value stabil, aman tidak dimasukkan sebagai dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, collapsedOffset]);

  // Peta memakai tinggi yang terlihat agar rute & tombol recenter tidak tertutup.
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
              <Avatar name={clientName ?? 'Client'} size={42} />
              <View style={styles.headerCopy}>
                <Text numberOfLines={1} style={styles.clientName}>
                  {clientName ?? 'Client MontirGo'}
                </Text>
                <Text numberOfLines={1} style={styles.clientMeta}>
                  {vehicleLabel || 'Kendaraan tidak dicantumkan'}
                </Text>
              </View>
              {isLive ? (
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              ) : null}
            </View>
          </View>
        </GestureDetector>

        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{isLive ? etaLabel : '—'}</Text>
            <Text style={styles.metricLabel}>{isLive ? 'sisa waktu' : 'belum berangkat'}</Text>
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

        {!hasLocation && locationError ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetryLocation}
            style={({ pressed }) => [styles.warning, pressed && styles.pressed]}
          >
            <Ionicons name="warning-outline" size={16} color={Brand.amber} />
            <Text style={styles.warningText}>{locationError}</Text>
            <Text style={styles.warningAction}>Aktifkan</Text>
          </Pressable>
        ) : null}

        {isLive && isNearDestination ? (
          <View style={styles.nearby}>
            <Ionicons name="sparkles" size={14} color={Brand.green} />
            <Text style={styles.nearbyText}>Kamu sudah dekat lokasi client</Text>
          </View>
        ) : null}

        <Button
          label={primary.label}
          icon={primary.icon}
          loading={busy}
          onPress={onPrimary}
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
            <Ionicons name="location" size={16} color={Brand.primary} />
            <Text numberOfLines={2} style={styles.address}>
              {address}
            </Text>
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

        <View style={styles.actionsWrap}>
          <TripActions phone={phone} onWhatsApp={onWhatsApp} onCall={onCall} onOpenMaps={onOpenMaps} />
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
  grabber: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, marginTop: 2 },
  headerCopy: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: '700', color: Brand.text },
  clientMeta: { fontSize: 11.5, color: Brand.textSecondary, marginTop: 2 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Brand.greenSoft,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.green },
  liveText: { fontSize: 10, fontWeight: '700', color: Brand.green },
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
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.md,
  },
  warningText: { flex: 1, fontSize: 11, color: Brand.amber, lineHeight: 16 },
  warningAction: { fontSize: 11, fontWeight: '700', color: Brand.amber },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.sm,
    marginTop: Space.md,
  },
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
  actionsWrap: { marginTop: Space.lg },
  nearby: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: Space.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Brand.greenSoft,
  },
  nearbyText: { fontSize: 11.5, fontWeight: '700', color: Brand.green },
  cta: { marginTop: Space.md, minHeight: 52 },
  hiddenDetails: { pointerEvents: 'none' },
  pressed: { opacity: 0.75 },
});
