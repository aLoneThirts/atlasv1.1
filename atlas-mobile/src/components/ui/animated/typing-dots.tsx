import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { AtlasColors } from '@/constants/atlas-theme';

/** Three bouncing dots — koç chat "typing…" indicator. */
export function TypingDots() {
  return (
    <View style={styles.row}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 850, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, [progress, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -5 * progress.value }],
    opacity: 0.4 + 0.6 * progress.value,
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    padding: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: AtlasColors.white,
  },
});
