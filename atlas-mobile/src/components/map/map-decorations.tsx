import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const STARS: { x: number; y: number }[] = [
  { x: 40, y: 110 },
  { x: 110, y: 80 },
  { x: 200, y: 120 },
  { x: 290, y: 90 },
  { x: 350, y: 140 },
  { x: 70, y: 170 },
];

const CLOUDS: { x: number; y: number; size: number }[] = [
  { x: 30, y: 200, size: 30 },
  { x: 270, y: 160, size: 38 },
  { x: 160, y: 235, size: 24 },
];

const TREES: { x?: number; right?: number; y: number; size: number; emoji: string }[] = [
  { x: 22, y: 620, size: 26, emoji: '🌳' },
  { x: 60, y: 650, size: 20, emoji: '🌲' },
  { right: 26, y: 610, size: 26, emoji: '🌲' },
  { right: 64, y: 645, size: 20, emoji: '🌳' },
  { x: 180, y: 660, size: 18, emoji: '🌲' },
];

/** Harita süslemeleri — parıldayan yıldızlar, sürüklenen bulutlar, sabit ağaçlar */
export function MapDecorations() {
  return (
    <>
      {STARS.map((s, i) => (
        <Star key={i} x={s.x} y={s.y} delay={i * 400} />
      ))}
      {CLOUDS.map((c, i) => (
        <Cloud key={i} x={c.x} y={c.y} size={c.size} delay={i * 2000} />
      ))}
      {TREES.map((t, i) => (
        <Text
          key={i}
          style={[
            styles.tree,
            { fontSize: t.size, top: t.y, left: t.x, right: t.right },
          ]}>
          {t.emoji}
        </Text>
      ))}
    </>
  );
}

function Star({ x, y, delay }: { x: number; y: number; delay: number }) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.95, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.35, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, [opacity, delay]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.Text style={[styles.star, { top: y, left: x }, style]}>✦</Animated.Text>
  );
}

function Cloud({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(22, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 7000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, [translateX, delay]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <Animated.Text style={[styles.cloud, { top: y, left: x, fontSize: size }, style]}>☁️</Animated.Text>
  );
}

const styles = StyleSheet.create({
  star: { position: 'absolute', fontSize: 18, color: '#FFFFFF' },
  cloud: { position: 'absolute', opacity: 0.85 },
  tree: { position: 'absolute' },
});
