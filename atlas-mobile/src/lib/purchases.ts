import { supabase } from './supabase';

/**
 * iyzico-pay Edge Function'a giden kart bilgisi (BACKEND.md §4.1/§4.9/§6.6).
 * Kart verisi hiçbir zaman bu dosyada/istemcide saklanmaz — yalnız tek seferlik
 * bu çağrıda function'a iletilir, orada iyzico'ya gider.
 */
export type CardInput = {
  holderName: string;
  number: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
};

export type Product = 'hearts_refill' | 'premium_monthly' | 'premium_yearly' | 'ads_removed';

/** Yalnız EKRANDA göstermek için — asıl tahsilat tutarı sunucuda (iyzico-pay PRICES) sabit. */
export const PRODUCT_PRICES: Record<Product, { amount: string; label: string }> = {
  hearts_refill: { amount: '14,90 TL', label: 'Can Yenileme (5/5)' },
  premium_monthly: { amount: '59 TL', label: 'Atlas Premium — Aylık' },
  premium_yearly: { amount: '229 TL', label: 'Atlas Premium — Yıllık' },
  ads_removed: { amount: '39 TL', label: 'Reklamları Kaldır' },
};

async function payWithIyzico(product: Product, card: CardInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke('iyzico-pay', { body: { product, card } });
  if (error) {
    let code = 'payment_failed';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) code = body.error;
      } catch {
        /* gövde json değilse genel hata koduyla devam */
      }
    }
    return { ok: false, error: code };
  }
  const res = data as { ok: boolean; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? 'payment_failed' };
  return { ok: true };
}

export type PremiumPlan = 'monthly' | 'yearly';

export async function buyHeartRefill(card: CardInput) {
  return payWithIyzico('hearts_refill', card);
}

export async function buyPremium(plan: PremiumPlan, card: CardInput) {
  return payWithIyzico(plan === 'monthly' ? 'premium_monthly' : 'premium_yearly', card);
}

export async function buyAdRemoval(card: CardInput) {
  return payWithIyzico('ads_removed', card);
}
