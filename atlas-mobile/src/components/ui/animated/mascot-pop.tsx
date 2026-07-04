import { useEffect } from 'react';
import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/** Scale-overshoot pop-in, re-triggered whenever `trigger` changes — e.g. quiz feedback mascot. */
export function MascotPop({ children, trigger, style }: { children: ReactNode; trigger?: unknown; style?: object }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = 0;
    scale.value = withSequence(
      withTiming(1.12, { duration: 150 }),
      withTiming(1, { duration: 120 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
