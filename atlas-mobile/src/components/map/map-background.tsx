import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { AtlasGradients } from '@/constants/atlas-theme';

/** Gökyüzü → zemin gradyanı — harita arkaplanı */
export function MapBackground() {
  return (
    <LinearGradient
      colors={AtlasGradients.map}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
