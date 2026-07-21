import { isValidElement, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AtlasColors, AtlasFonts, AtlasRadius, Press3D, ledgeShadow, ledgeShadowWeb } from '@/constants/atlas-theme';

export type Btn3DVariant = 'green' | 'red' | 'blue' | 'purple' | 'orange' | 'yellow' | 'ghost' | 'disabled';

type VariantStyle = { bg: string; shadow: string; text: string; border?: string };

const VARIANTS: Record<Btn3DVariant, VariantStyle> = {
  green: { bg: AtlasColors.green, shadow: AtlasColors.greenShadow, text: AtlasColors.white },
  red: { bg: AtlasColors.red, shadow: AtlasColors.redDark, text: AtlasColors.white },
  blue: { bg: AtlasColors.blue, shadow: AtlasColors.blueDark, text: AtlasColors.white },
  purple: { bg: AtlasColors.purple, shadow: AtlasColors.violet, text: AtlasColors.white },
  orange: { bg: AtlasColors.orange, shadow: AtlasColors.orangeDark, text: AtlasColors.white },
  yellow: { bg: AtlasColors.yellow, shadow: AtlasColors.yellowDark, text: '#5B4400' },
  ghost: { bg: 'rgba(255,255,255,0.15)', shadow: 'transparent', text: AtlasColors.white, border: 'rgba(255,255,255,0.4)' },
  disabled: { bg: AtlasColors.line, shadow: AtlasColors.gray, text: AtlasColors.gray },
};

export function Btn3D({
  variant = 'green',
  size = 'default',
  onPress,
  children,
  disabled,
  style,
}: {
  variant?: Btn3DVariant;
  size?: 'default' | 'small';
  onPress?: () => void;
  children: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[disabled ? 'disabled' : variant];
  const isGhost = variant === 'ghost' && !disabled;
  const small = size === 'small';
  const translateY = useSharedValue(0);
  const pressed = useSharedValue(false);
  const hovered = useSharedValue(false);

  // Basılınca tam iner (Press3D.pressTranslate) — bu, web hover'ından bile
  // önceliklidir. Yalnız hover'dayken (basılı değil) hafifçe yükselir; bu,
  // butonun "tıklamaya hazır" görünmesini sağlayan bir web-only ipucu,
  // native'de onHoverIn hiç tetiklenmediği için zararsızca no-op kalır.
  const innerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withTiming(pressed.value ? Press3D.pressTranslate : hovered.value ? -1 : 0, {
          duration: 100,
        }),
      },
    ],
  }));

  const shadowStyle = Platform.OS === 'web' ? ledgeShadowWeb(v.shadow, Press3D.shadowHeight) : ledgeShadow(v.shadow, Press3D.shadowHeight);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = true;
      }}
      onPressOut={() => {
        pressed.value = false;
      }}
      onHoverIn={() => {
        hovered.value = true;
      }}
      onHoverOut={() => {
        hovered.value = false;
      }}
      style={[styles.wrapper, { borderRadius: small ? 12 : AtlasRadius.button }, style]}>
      <View
        style={[
          styles.shadowLayer,
          { backgroundColor: isGhost ? 'transparent' : v.shadow, borderRadius: small ? 12 : AtlasRadius.button },
          !isGhost && shadowStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.inner,
          small ? styles.innerSmall : styles.innerDefault,
          {
            backgroundColor: v.bg,
            borderRadius: small ? 12 : AtlasRadius.button,
            borderWidth: v.border ? 2 : 0,
            borderColor: v.border,
          },
          innerStyle,
        ]}>
        {isValidElement(children) ? (
          children
        ) : (
          <Text style={[styles.text, small && styles.textSmall, { color: v.text }]}>{children}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: Press3D.shadowHeight,
    bottom: 0,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDefault: {
    paddingVertical: 15,
    paddingHorizontal: 24,
  },
  innerSmall: {
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  text: {
    fontFamily: AtlasFonts.heading,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  textSmall: {
    fontSize: 13,
  },
});
