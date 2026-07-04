import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AtlasColors, AtlasRadius } from '@/constants/atlas-theme';

/**
 * EKRAN 03 — Ana Sayfa (Ev)
 * Prototip referansı: ../index.html #scr-home
 * TODO: streak/XP kartları, devam et kartı, harita teaser'ı Supabase verisiyle.
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>G</Text>
          </View>
          <View>
            <Text style={styles.hello}>Günaydın! ☀️</Text>
            <Text style={styles.name}>Göktuğ</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/atlas/mascot-wave.png')}
            style={styles.mascot}
            contentFit="contain"
          />
          <Text style={styles.title}>Atlas RN iskeleti hazır</Text>
          <Text style={styles.sub}>
            Ana Sayfa ekranı prototipten buraya port edilecek.{'\n'}
            Referans: index.html → EKRAN 03
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AtlasColors.surface },
  safe: { flex: 1, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: AtlasColors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: AtlasColors.white, fontSize: 20, fontWeight: '900' },
  hello: { color: AtlasColors.gray, fontSize: 11, fontWeight: '600' },
  name: { color: AtlasColors.inkStrong, fontSize: 17, fontWeight: '900' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  mascot: { width: 180, height: 180 },
  title: { fontSize: 20, fontWeight: '900', color: AtlasColors.inkStrong },
  sub: { textAlign: 'center', color: AtlasColors.gray, fontSize: 13, lineHeight: 20 },
});
