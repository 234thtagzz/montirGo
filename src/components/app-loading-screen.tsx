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

/**
 * Layar tunggu aplikasi.
 *
 * Palet mengikuti Beranda: permukaan ink "Night Garage" dengan glow biru
 * elektrik, aksen volt hanya sebagai sinyal live, dan teks inkText/inkMuted.
 * Tidak ada permukaan terang besar agar transisi ke Beranda terasa menyatu.
 */
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
  const blink = useSharedValue(reduceMotion ? 1 : 0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;

    if (!instant) {
      intro.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
      pop.value = withSpring(1, { damping: 13, stiffness: 90, mass: 0.9 });
      copy.value = withDelay(260, withTiming(1, { duration: 680, easing: Easing.out(Easing.cubic) }));
    }

    pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1);
    spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1);
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
    blink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [blink, copy, float, instant, intro, pop, pulse, reduceMotion, shimmer, spin]);

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
    opacity: 0.45 * (1 - pulse.value),
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
    opacity: copy.value * 0.9,
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

  const statusDotStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + blink.value * 0.65,
  }));

  return (
    <Animated.View
      accessibilityLabel="Memuat MontirGo"
      onLayout={onLayout}
      style={[styles.screen, screenStyle, exiting ? styles.screenExiting : null]}
    >
      <StatusBar style="light" />

      {/* Dasar gelap yang sama dengan header Beranda. */}
      <LinearGradient
        colors={Gradient.header}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* Cahaya biru dari kiri atas. */}
        <LinearGradient
          colors={['rgba(11,107,255,0.30)', 'rgba(11,18,32,0)']}
          locations={[0, 0.62]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.9, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Pantulan volt tipis dari kanan bawah. */}
        <LinearGradient
          colors={['rgba(201,241,88,0.13)', 'rgba(201,241,88,0)']}
          locations={[0, 0.6]}
          start={{ x: 0.9, y: 1 }}
          end={{ x: 0.2, y: 0.3 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Vignette agar fokus ke tengah dan footer menyatu. */}
        <LinearGradient
          colors={['rgba(11,18,32,0)', 'rgba(11,18,32,0.88)']}
          locations={[0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        <LinearGradient
          colors={['rgba(11,107,255,0.26)', 'rgba(11,107,255,0)']}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.glowTop}
        />
        <LinearGradient
          colors={['rgba(201,241,88,0.16)', 'rgba(201,241,88,0)']}
          start={{ x: 0.2, y: 0.8 }}
          end={{ x: 0.9, y: 0.1 }}
          style={styles.glowBottom}
        />

        <View style={styles.sparkTop}>
          <Ionicons name="add" size={16} color="rgba(220,228,245,0.22)" />
        </View>
        <View style={styles.sparkBottom}>
          <Ionicons name="add" size={12} color="rgba(220,228,245,0.18)" />
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.stage}>
          <View style={styles.orbit} />
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
            <Ionicons name="construct-outline" size={16} color={Brand.volt} />
          </Animated.View>
          <Animated.View style={[styles.chip, styles.chipBottom, chipBottomStyle]}>
            <Ionicons name="flash-outline" size={15} color={Brand.inkText} />
          </Animated.View>
        </View>

        <Animated.View style={wordmarkStyle}>
          <Text style={styles.wordmark}>
            Montir<Text style={styles.wordmarkAccent}>Go</Text>
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.tagline, taglineStyle]}>
          MONTIR TERDEKAT, SIAP BANTU
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
              colors={['rgba(201,241,88,0)', Brand.volt, 'rgba(201,241,88,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
        <View style={styles.statusRow}>
          <Animated.View style={[styles.statusDot, statusDotStyle]} />
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {status}
          </Text>
        </View>
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
    backgroundColor: Brand.ink,
    overflow: 'hidden',
  },
  screenExiting: { pointerEvents: 'none' },
  glowTop: {
    position: 'absolute',
    width: 460,
    height: 460,
    borderRadius: 230,
    top: -210,
    right: -160,
  },
  glowBottom: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    bottom: -190,
    left: -150,
  },
  sparkTop: { position: 'absolute', top: '22%', left: '15%' },
  sparkBottom: { position: 'absolute', bottom: '28%', right: '16%' },
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
  orbit: {
    position: 'absolute',
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    borderRadius: STAGE_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(220,228,245,0.07)',
  },
  baseRing: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1,
    borderColor: 'rgba(220,228,245,0.12)',
  },
  halo: {
    position: 'absolute',
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    borderRadius: STAGE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(201,241,88,0.55)',
  },
  arc: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: Brand.volt,
    borderRightColor: 'rgba(201,241,88,0.16)',
  },
  logoTile: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 24,
    backgroundColor: '#F7FAFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 16,
  },
  logoClip: {
    flex: 1,
    borderRadius: 24,
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
    backgroundColor: 'rgba(220,228,245,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220,228,245,0.16)',
  },
  chipTop: { top: 12, right: -4 },
  chipBottom: { bottom: 16, left: -6 },
  wordmark: {
    marginTop: Space.xxl,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: Brand.white,
  },
  wordmarkAccent: { color: Brand.volt, fontWeight: '700' },
  tagline: {
    marginTop: Space.sm,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: Brand.inkMuted,
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
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(220,228,245,0.12)',
  },
  thumb: {
    width: THUMB_WIDTH,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: Space.md,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Brand.volt,
  },
  status: {
    fontSize: 11.5,
    letterSpacing: 0.3,
    color: Brand.inkMuted,
  },
});
