import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';

export function ProgressBar({
  progress,
  color = AtlasColors.green,
  trackColor = AtlasColors.line,
  height = 16,
}: {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(1, progress)) * 100, {
      duration: 600,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [progress, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: AtlasRadius.pill }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: AtlasRadius.pill }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
