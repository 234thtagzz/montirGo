import { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Blok placeholder berdenyut (Reanimated) yang menghormati Reduce Motion. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius,
  style,
}: SkeletonProps) {
  const { theme } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 0.72 : 0.45);
  const resolvedRadius = radius ?? theme.radii.sm;

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.72;
      return;
    }

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 720 }),
        withTiming(0.45, { duration: 720 }),
      ),
      -1,
    );
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: resolvedRadius,
          borderCurve: 'continuous',
          backgroundColor: theme.colors.skeletonBase,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
