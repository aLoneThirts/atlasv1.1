import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

/** Soft glow behind an image/icon — stack in a parent View before the foreground element to control z-order. */
const LAYERS = [
  { scale: 1, baseOpacity: 0.5 },
  { scale: 1.3, baseOpacity: 0.3 },
  { scale: 1.6, baseOpacity: 0.15 },
];

export function GlowHalo({
  color,
  size,
  opacity = 1,
}: {
  color: string;
  size: number;
  opacity?: SharedValue<number> | number;
}) {
  const localOpacity = useSharedValue(typeof opacity === 'number' ? opacity : 0);

  useEffect(() => {
    if (typeof opacity === 'number') {
      localOpacity.value = opacity;
    }
  }, [opacity, localOpacity]);

  const sharedOpacity = typeof opacity === 'number' ? localOpacity : opacity;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size * 1.6,
        height: size * 1.6,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {LAYERS.map((layer, i) => (
        <GlowLayer
          key={i}
          color={color}
          diameter={size * layer.scale}
          baseOpacity={layer.baseOpacity}
          opacity={sharedOpacity}
        />
      ))}
    </View>
  );
}

function GlowLayer({
  color,
  diameter,
  baseOpacity,
  opacity,
}: {
  color: string;
  diameter: number;
  baseOpacity: number;
  opacity: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: baseOpacity * opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: diameter,
          height: diameter,
          borderRadius: 9999,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
