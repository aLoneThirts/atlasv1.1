import { supabase } from './supabase';

/**
 * ⚠️ PLACEHOLDER — gerçek uygulama içi satın alma (RevenueCat / App Store /
 * Play Store IAP) henüz kurulmadı; Apple Developer Program + Google Play
 * Console hesapları hazır olunca bağlanacak. Bu, tüm ekranların kullandığı
 * TEK çağrı noktası — gerçek IAP'a geçildiğinde yalnız bu fonksiyonun İÇİ
 * değişecek (RevenueCat `Purchases.purchaseProduct(...)` + makbuz doğrulama),
 * çağıran ekranlar (ör. "Canın Bitti") değişmeyecek.
 *
 * Satın alma tipi: ANLIK TAM DOLDURMA (can 5/5 olur, kapasite tavanı aşılmaz).
 * Gerçek IAP kurulunca yapılacaklar:
 *   1. `react-native-purchases` paketini kur, RevenueCat projesine bağla.
 *   2. App Store Connect + Play Console'da "can_doldur" tüketilebilir (consumable)
 *      ürününü tanımla, RevenueCat'e ekle.
 *   3. Aşağıdaki mock çağrıyı gerçek `Purchases.purchaseProduct('can_doldur')`
 *      + makbuz doğrulamasıyla değiştir; başarılıysa yine `refill_hearts` RPC'sini çağır.
 */
export async function buyHeartRefill(): Promise<{ ok: true; hearts: number } | { ok: false; error: string }> {
  try {
    const { data, error } = await supabase.rpc('refill_hearts');
    if (error) throw error;
    return { ok: true, hearts: (data as { hearts?: number } | null)?.hearts ?? 5 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type PremiumPlan = 'monthly' | 'yearly';

/**
 * ⚠️ PLACEHOLDER — bkz. dosya başındaki not. Gerçek IAP kurulunca RevenueCat
 * `Purchases.purchaseProduct('atlas_premium_aylik' | 'atlas_premium_yillik')`
 * çağrılıp başarılı makbuz sonrası burası çalıştırılmalı (webhook zaten
 * is_premium'u günceller, bu RPC çağrısı istemci tarafında anında yansıması
 * için — RevenueCat'e geçilince client'ın kendisi bu RPC'yi ARTIK ÇAĞIRMAYACAK,
 * yalnız webhook güncelleyecek).
 */
export async function buyPremium(_plan: PremiumPlan): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await supabase.rpc('dev_set_premium', { active: true });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** ⚠️ PLACEHOLDER — reklamsız tek seferlik satın alma. Bkz. buyPremium notu. */
export async function buyAdRemoval(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await supabase.rpc('dev_set_ads_removed', { active: true });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
