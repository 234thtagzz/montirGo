import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@/components/ui/icon';
import { Brand, Gradient, Space } from '@/constants/brand';

const STAGE_SIZE = 168;
const LOGO_SIZE = 92;
const TRACK_WIDTH = 176;
const THUMB_WIDTH = 62;

interface AppLoadingScreenProps {
  /** Teks status di bawah indikator progres. */
  status?: string;
  /** Set true untuk memutar animasi keluar (fade + scale) sebelum layar dilepas. */
  exiting?: boolean;
  /** Lewati animasi masuk, dipakai saat transisi dari splash sebelumnya agar mulus. */
  instant?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}


export function AppLoadingScreen({
  status = 'Menyiapkan layanan…',
  exiting = false,
  instant = false,
  onLayout,
}: AppLoadingScreenProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const intro = useSharedValue(instant || reduceMotion ? 1 : 0);
  const pop = useSharedValue(instant || reduceMotion ? 1 : 0.7);
  const copy = useSharedValue(instant || reduceMotion ? 1 : 0);
  const pulse = useSharedValue(reduceMotion ? 1 : 0);
  const spin = useSharedValue(0);
  const float = useSharedValue(0);
  const shimmer = useSharedValue(reduceMotion ? 0.5 : 0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;

    if (!instant) {
      intro.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
      pop.value = withSpring(1, { damping: 13, stiffness: 90, mass: 0.9 });
      copy.value = withDelay(260, withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) }));
    }

    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1);
    spin.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.linear }), -1);
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
    );
  }, [copy, float, instant, intro, pop, pulse, reduceMotion, shimmer, spin]);

  useEffect(() => {
    if (exiting) {
      exit.value = withTiming(1, { duration: 320, easing: Easing.in(Easing.cubic) });
    }
  }, [exit, exiting]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 - exit.value * 0.03 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 0.82 + pulse.value * 0.58 }],
  }));

  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [
      { scale: interpolate(pop.value, [0, 1], [0.72, 1]) },
      { rotate: `${interpolate(pop.value, [0, 1], [-10, 0])}deg` },
    ],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: copy.value,
    transform: [{ translateY: interpolate(copy.value, [0, 1], [16, 0]) }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: copy.value * 0.86,
    transform: [{ translateY: interpolate(copy.value, [0, 1], [12, 0]) }],
  }));

  const chipTopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * -8 }],
  }));

  const chipBottomStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * 8 }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-THUMB_WIDTH, TRACK_WIDTH]) }],
  }));

  return (
    <Animated.View
      accessibilityLabel="Memuat MontirGo"
      onLayout={onLayout}
      style={[styles.screen, screenStyle, exiting ? styles.screenExiting : null]}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={Gradient.splash}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.orbTop} />
        <View style={styles.orbBottom} />
        <View style={styles.orbMiddle} />
        <Ionicons name="sparkles" size={18} color="rgba(255,255,255,0.3)" style={styles.sparkTop} />
        <Ionicons
          name="sparkles"
          size={12}
          color="rgba(255,255,255,0.24)"
          style={styles.sparkBottom}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.stage}>
          <View style={styles.baseRing} />
          <Animated.View style={[styles.halo, haloStyle]} />
          <Animated.View style={[styles.arc, arcStyle]} />

          <Animated.View style={[styles.logoTile, logoStyle]}>
            <View style={styles.logoClip}>
              <Image
                source={require('@/assets/images/montirgo-mark.png')}
                style={styles.logoImage}
                contentFit="contain"
                transition={0}
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.chip, styles.chipTop, chipTopStyle]}>
            <Ionicons name="construct-outline" size={16} color={Brand.white} />
          </Animated.View>
          <Animated.View style={[styles.chip, styles.chipBottom, chipBottomStyle]}>
            <Ionicons name="flash-outline" size={15} color={Brand.white} />
          </Animated.View>
        </View>

        <Animated.View style={wordmarkStyle}>
          <Text style={styles.wordmark}>
            Montir<Text style={styles.wordmarkAccent}>Go</Text>
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.tagline, taglineStyle]}>
          Montir terdekat, siap bantu
        </Animated.Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 36 }]}>
        <View
          accessibilityLabel={status}
          accessibilityRole="progressbar"
          style={styles.track}
        >
          <Animated.View style={[styles.thumb, progressStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.15)', '#FFFFFF', 'rgba(255,255,255,0.15)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {status}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Brand.primary,
    overflow: 'hidden',
  },
  screenExiting: { pointerEvents: 'none' },
  orbTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -130,
    right: -110,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  orbMiddle: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: '42%',
    left: -110,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  orbBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: -120,
    right: -70,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  sparkTop: { position: 'absolute', top: '24%', left: '16%' },
  sparkBottom: { position: 'absolute', bottom: '27%', right: '18%' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xxl,
  },
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseRing: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  halo: {
    position: 'absolute',
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    borderRadius: STAGE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  arc: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.95)',
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  logoTile: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 22,
    backgroundColor: Brand.primary,
    shadowColor: '#04264F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 14,
  },
  logoClip: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  chip: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  chipTop: { top: 12, right: -4 },
  chipBottom: { bottom: 16, left: -6 },
  wordmark: {
    marginTop: Space.xxl,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Brand.white,
  },
  wordmarkAccent: { color: '#D5E9FF', fontWeight: '600' },
  tagline: {
    marginTop: Space.sm,
    fontSize: 13,
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.82)',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  track: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  thumb: {
    width: THUMB_WIDTH,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  status: {
    marginTop: Space.md,
    fontSize: 11.5,
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.74)',
  },
});
