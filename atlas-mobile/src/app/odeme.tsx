import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardForm } from '@/components/payment/card-form';
import { AtlasFonts, AtlasGradients } from '@/constants/atlas-theme';
import { safeGoBack } from '@/lib/navigation';
import { buyAdRemoval, buyHeartRefill, buyPremium, PRODUCT_PRICES, type CardInput, type Product } from '@/lib/purchases';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_card: 'Kart bilgilerini kontrol et.',
  invalid_product: 'Bu ürün şu anda satın alınamıyor.',
  rate_limited: 'Çok fazla deneme yaptın, biraz sonra tekrar dene.',
  payment_gateway_error: 'Ödeme sağlayıcısına ulaşılamadı, tekrar dene.',
  auth_required: 'Oturumun sona ermiş, tekrar giriş yap.',
  profile_not_found: 'Profil bulunamadı, tekrar giriş yapmayı dene.',
};

const SUCCESS_COPY: Record<Product, { emoji: string; title: string; body: string }> = {
  hearts_refill: { emoji: '❤️', title: 'Canların Doldu!', body: '5/5 canla kaleye geri dönebilirsin.' },
  premium_monthly: { emoji: '👑', title: 'Hoş geldin, Komutan!', body: 'Premium aktif — tüm kaleler ve koç artık senin.' },
  premium_yearly: { emoji: '👑', title: 'Hoş geldin, Komutan!', body: 'Premium aktif — tüm kaleler ve koç artık senin.' },
  ads_removed: { emoji: '🚫📺', title: 'Hazır!', body: 'Artık reklamsız devam ediyorsun.' },
};

/**
 * Modal ödeme ekranı — can/premium/reklamsız satın almanın tek giriş noktası.
 * `product` param'ına göre kart formunu iyzico-pay Edge Function'a bağlar
 * (bkz. lib/purchases.ts). Başarılı ödemede tebrik ekranı gösterip kapanır.
 */
export default function OdemeScreen() {
  const router = useRouter();
  const { product } = useLocalSearchParams<{ product: Product }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const info = PRODUCT_PRICES[product] ?? PRODUCT_PRICES.hearts_refill;

  const submit = async (card: CardInput) => {
    setBusy(true);
    setError(null);
    const res =
      product === 'premium_monthly'
        ? await buyPremium('monthly', card)
        : product === 'premium_yearly'
          ? await buyPremium('yearly', card)
          : product === 'ads_removed'
            ? await buyAdRemoval(card)
            : await buyHeartRefill(card);
    setBusy(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      setError(ERROR_MESSAGES[res.error] ?? res.error);
    }
  };

  const successInfo = SUCCESS_COPY[product] ?? SUCCESS_COPY.hearts_refill;

  return (
    <LinearGradient colors={AtlasGradients.onboarding} style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => safeGoBack(router)} hitSlop={10}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
          <Text style={styles.title}>Ödeme</Text>
          <View style={styles.headerSpacer} />
        </View>
        {success ? (
          <View style={styles.successWrap}>
            <Text style={styles.successEmoji}>{successInfo.emoji}</Text>
            <Text style={styles.successTitle}>{successInfo.title}</Text>
            <Text style={styles.successBody}>{successInfo.body}</Text>
            <Pressable style={styles.successBtn} onPress={() => safeGoBack(router)}>
              <Text style={styles.successBtnText}>Tamam</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <CardForm productLabel={info.label} priceLabel={info.amount} busy={busy} error={error} onSubmit={submit} />
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  close: { color: 'rgba(255,255,255,0.85)', fontSize: 20, fontFamily: AtlasFonts.heading },
  title: { color: 'rgba(255,255,255,0.95)', fontSize: 16, fontFamily: AtlasFonts.headingBold },
  headerSpacer: { width: 20 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10 },
  successEmoji: { fontSize: 56 },
  successTitle: { color: '#fff', fontSize: 22, fontFamily: AtlasFonts.heading, textAlign: 'center' },
  successBody: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  successBtn: {
    marginTop: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  successBtnText: { color: '#1A2A3D', fontFamily: AtlasFonts.heading, fontSize: 14 },
});
