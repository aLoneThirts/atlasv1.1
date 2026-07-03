import { useState } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { AtlasColors, AtlasRadius, Press3D } from '@/constants/atlas-theme';

type Props = {
  label: string;
  onPress: () => void;
  /** üst yüzey rengi */
  color?: string;
  /** alt gölge rengi */
  colorDark?: string;
  textColor?: string;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
};

/** Duolingo tarzı 3D buton — basılınca alt gölgenin üstüne oturur */
export function Btn3d({
  label,
  onPress,
  color = AtlasColors.green,
  colorDark = AtlasColors.greenShadow,
  textColor = AtlasColors.white,
  disabled = false,
  small = false,
  style,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const lift = pressed || disabled ? 0 : Press3D.shadowHeight;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.shadow,
        { backgroundColor: disabled ? AtlasColors.line : colorDark, marginTop: Press3D.shadowHeight },
        style,
      ]}>
      <Text
        style={[
          styles.face,
          small && styles.faceSmall,
          {
            backgroundColor: disabled ? AtlasColors.card : color,
            color: disabled ? AtlasColors.gray : textColor,
            transform: [{ translateY: -lift }],
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: AtlasRadius.button,
  },
  face: {
    borderRadius: AtlasRadius.button,
    paddingVertical: 15,
    paddingHorizontal: 18,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '900',
    overflow: 'hidden',
  },
  faceSmall: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
  },
});
