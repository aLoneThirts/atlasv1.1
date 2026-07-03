import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AtlasColors } from '@/constants/atlas-theme';

/**
 * EKRAN 11 — Koç
 * Prototip referansı: ../index.html #scr-coach
 * TODO: "Koç Biliyor" veri çipleri, sohbet listesi (coach_messages tablosu),
 * deneme girişi (mock_exams tablosu), Gemini Flash entegrasyonu (Edge Function).
 */
export default function CoachScreen() {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/atlas/mascot-wave.png')}
        style={styles.mascot}
        contentFit="contain"
      />
      <Text style={styles.title}>🤖 Atlas Koçu</Text>
      <Text style={styles.sub}>Sohbet ekranı buraya port edilecek.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AtlasColors.coachBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mascot: { width: 150, height: 150 },
  title: { color: AtlasColors.white, fontSize: 20, fontWeight: '900' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
