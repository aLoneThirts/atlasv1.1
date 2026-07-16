import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PremiumBenefits } from '@/components/premium/premium-benefits';
import { AtlasFonts, AtlasGradients, AtlasLayout } from '@/constants/atlas-theme';
import { safeGoBack } from '@/lib/navigation';
import type { PremiumPlan } from '@/lib/purchases';

/**
 * EKRAN — Premium paywall. `koc.tsx` / `haftalik.tsx` kilit ekranlarından
 * ve harita'da kilitli kale dokunuşundan buraya yönlendirilir. Plan seçimi
 * /odeme kart-formu modalını açar (iyzico, bkz. lib/purchases.ts).
 */
export default function PremiumScreen() {
  const router = useRouter();

  const subscribe = (p: PremiumPlan) => {
    router.push({ pathname: '/odeme', params: { product: p === 'monthly' ? 'premium_monthly' : 'premium_yearly' } } as never);
  };

  return (
    <LinearGradient colors={AtlasGradients.bossGold} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack(router)} hitSlop={10}>
            <Text style={styles.back}>‹ Geri</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Image
            source={require('@/assets/images/atlas/castle-tyt.png')}
            style={styles.crest}
            contentFit="contain"
          />
          <Text style={styles.trust}>🔒 Ödemeler iyzico güvencesiyle işlenir</Text>
          <PremiumBenefits onSubscribe={subscribe} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { paddingHorizontal: 18, paddingVertical: 10 },
  back: { color: '#5B4400', fontSize: 15, fontFamily: AtlasFonts.bodyBold },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: AtlasLayout.maxFormWidth,
    alignSelf: 'center',
  },
  crest: { width: 96, height: 96 },
  trust: {
    color: 'rgba(0,0,0,0.55)',
    fontSize: 11.5,
    fontFamily: AtlasFonts.bodySemi,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.35)',
    padding: 8,
    borderRadius: 12,
  },
});
