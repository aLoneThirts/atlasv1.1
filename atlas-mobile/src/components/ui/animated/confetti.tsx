import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { AtlasColors } from '@/constants/atlas-theme';

const COLORS = [AtlasColors.green, AtlasColors.yellow, AtlasColors.red, AtlasColors.blue, AtlasColors.purple, AtlasColors.orange];
const PARTICLE_COUNT = 24;

/** One-shot confetti burst — toggle `fire` true on a great quiz result. */
export function Confetti({ fire }: { fire: boolean }) {
  const { width } = useWindowDimensions();

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
        id: i,
        x: Math.random() * width,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 300,
        rotateDir: Math.random() > 0.5 ? 1 : -1,
        duration: 1500 + Math.random() * 500,
      })),
    [width]
  );

  if (!fire) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}
    </View>
  );
}

function Particle({ x, color, delay, rotateDir, duration }: { x: number; color: string; delay: number; rotateDir: number; duration: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.linear }));
  }, [delay, duration, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, progress.value - 0.7) / 0.3,
    transform: [
      { translateY: progress.value * 900 },
      { rotate: `${progress.value * 720 * rotateDir}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: x, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
    top: -20,
    width: 8,
    height: 8,
    borderRadius: 2,
  },
});
