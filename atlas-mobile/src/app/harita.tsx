import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AtlasColors } from '@/constants/atlas-theme';

/**
 * EKRAN 04 — Fetih Haritası
 * Prototip referansı: ../index.html #scr-map
 * TODO: gökyüzü→zemin gradyanı (expo-linear-gradient), 7 radyal kale,
 * merkez 3D kale (assets/images/atlas/castle-tyt.png), SVG altın yollar.
 */
export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/atlas/castle-tyt.png')}
        style={styles.castle}
        contentFit="contain"
      />
      <Text style={styles.title}>🗺️ Fetih Haritası</Text>
      <Text style={styles.sub}>7 kale + TYT Ana Kalesi buraya port edilecek.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A3A5C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  castle: { width: 160, height: 160 },
  title: { color: AtlasColors.white, fontSize: 20, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
