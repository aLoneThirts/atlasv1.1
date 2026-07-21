import { type ReactNode } from 'react';
import { Pressable, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Pressable'ın KENDİSİNİ animasyonlu bileşene çeviriyoruz (ekstra bir sarmalayıcı
// View eklemek yerine) — `style` (flex:1, position:absolute, vb.) tam olarak
// gerçek dokunma hedefine uygulanmış olur. Önceki sürümde style, iç bir
// Animated.View'a veriliyordu; bu, `flex:1` içeren stillerin (ör. bir satırdaki
// eşit genişlikli sekmeler) çalışmamasına yol açan gerçek bir düzen hatasıydı —
// dıştaki Pressable stilsiz kaldığı için flex item olarak büzülüyordu.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Btn3D olmayan tüm tıklanabilir öğeler (kartlar, liste satırları, teaser
 * bantları, çipler) için ortak dokunma/hover sarmalayıcısı — `Pressable`'a
 * neredeyse birebir yerine geçer (aynı `style`/`onPress` imzası).
 *
 * Web'de mouse hover'da hafif yükselip büyür (`onHoverIn`/`onHoverOut` —
 * react-native-web'in Pressable'ı bunları destekler, native'de hiç
 * tetiklenmez, dokunmatik ekranda "hover" diye bir şey olmadığı için
 * zararsızca no-op kalır). Her platformda dokununca hafif küçülür — bu,
 * Btn3D'nin translateY tabanlı 3D basma efektinden farklı, gölgesiz/düz
 * öğeler için daha uygun bir "sıkışma" tepkisi.
 *
 * NOT: `position: 'absolute'` ile mutlak konumlanan öğelerde (ör. harita
 * kale ikonları) kullanma — scale/translateY transformu absolute konumlu
 * öğelerde beklenmedik kaymalara yol açabilir, oralarda düz Pressable kalsın.
 */
export function Interactive({
  onPress,
  children,
  style,
  disabled,
  hoverScale = 1.015,
  pressScale = 0.97,
  hoverLift = 2,
  hitSlop,
}: {
  onPress?: (event: GestureResponderEvent) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Web hover'da hedef ölçek — varsayılan hafif büyüme. */
  hoverScale?: number;
  /** Her platformda basılı tutulunca hedef ölçek — varsayılan hafif küçülme. */
  pressScale?: number;
  /** Web hover'da yukarı kayma (px) — kart "kalkıyor" hissi verir. */
  hoverLift?: number;
  hitSlop?: number;
}) {
  const hovered = useSharedValue(0);
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => {
    const isPressed = pressed.value > 0.5;
    const isHovered = hovered.value > 0.5;
    const scale = isPressed ? pressScale : isHovered ? hoverScale : 1;
    const translateY = isPressed ? 0 : isHovered ? -hoverLift : 0;
    return {
      transform: [
        { scale: withTiming(scale, { duration: 140 }) },
        { translateY: withTiming(translateY, { duration: 140 }) },
      ],
    };
  });

  return (
    <AnimatedPressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      onHoverIn={() => {
        hovered.value = 1;
      }}
      onHoverOut={() => {
        hovered.value = 0;
      }}
      style={[style, animStyle]}>
      {children}
    </AnimatedPressable>
  );
}
