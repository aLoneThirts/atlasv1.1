// ============================================================
// ATLAS — iyzico-pay Edge Function (BACKEND.md §4.1, §4.9, §6.6, §7)
// iyzico API key/secret istemciye ASLA konmaz; bu function proxy'dir.
// RevenueCat kararının yerine geçti — bkz. BACKEND.md §4.9.
//
// Input : { product: 'hearts_refill'|'premium_monthly'|'premium_yearly'|'ads_removed',
//           card: { holderName, number, expireMonth, expireYear, cvc } }
// Output: { ok: true, product } | { ok: false, error }
//
// Akış:
//   1. JWT → kullanıcı (auth.uid())
//   2. Rate limit: kullanıcı başına saatte 10 ödeme denemesi
//   3. Fiyat SUNUCUDA sabit (client asla fiyat göndermez, bkz. PRICES)
//   4. iyzico /payment/auth çağrısı — HMACSHA256 imza (docs.iyzico.com,
//      Authorization: "IYZWSv2 " + base64("apiKey:..&randomKey:..&signature:.."),
//      signature = hex(HMACSHA256(randomKey + "/payment/auth" + body, secretKey)))
//   5. payments tablosuna audit satırı (başarılı/başarısız fark etmeksizin)
//   6. Başarılıysa profiles'ı service_role ile güncelle:
//      hearts_refill → hearts=5; premium_* → is_premium=true +
//      premium_expires_at (aktif abonelik varsa üstüne eklenir); ads_removed → ads_removed=true
//
// Deploy: npx supabase functions deploy iyzico-pay
// Secrets: npx supabase secrets set IYZICO_API_KEY=... IYZICO_SECRET_KEY=...
//          (opsiyonel IYZICO_BASE_URL, varsayılan sandbox)
// ⚠️ v1: buyer.identityNumber/adres alanları sandbox test amaçlı sabit
// değerlerle dolduruluyor (gerçek KYC toplamıyoruz — dijital ürün, kargo yok).
// Prod'a geçerken bu alanların gerçek kullanıcı verisiyle doldurulup
// doldurulmayacağı ayrıca değerlendirilmeli.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Product = 'hearts_refill' | 'premium_monthly' | 'premium_yearly' | 'ads_removed';

const PRICES: Record<Product, { amount: number; label: string }> = {
  hearts_refill: { amount: 14.9, label: 'Can Yenileme (5/5)' },
  premium_monthly: { amount: 59.0, label: 'Atlas Premium — Aylık' },
  premium_yearly: { amount: 229.0, label: 'Atlas Premium — Yıllık' },
  ads_removed: { amount: 39.0, label: 'Reklamları Kaldır' },
};

const HOURLY_LIMIT = 10;

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

type CardInput = {
  holderName: string;
  number: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
};

function validCard(card: unknown): card is CardInput {
  if (!card || typeof card !== 'object') return false;
  const c = card as Record<string, unknown>;
  return (
    typeof c.holderName === 'string' && c.holderName.trim().length > 0 && c.holderName.length <= 100 &&
    typeof c.number === 'string' && /^\d{12,19}$/.test(c.number.replace(/\s+/g, '')) &&
    typeof c.expireMonth === 'string' && /^(0[1-9]|1[0-2])$/.test(c.expireMonth) &&
    typeof c.expireYear === 'string' && /^(\d{2}|\d{4})$/.test(c.expireYear) &&
    typeof c.cvc === 'string' && /^\d{3,4}$/.test(c.cvc)
  );
}

async function signIyzico(secretKey: string, randomKey: string, uriPath: string, bodyString: string) {
  const payload = randomKey + uriPath + bodyString;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('IYZICO_API_KEY');
  const secretKey = Deno.env.get('IYZICO_SECRET_KEY');
  const baseUrl = Deno.env.get('IYZICO_BASE_URL') ?? 'https://sandbox-api.iyzipay.com';
  if (!apiKey || !secretKey) return json({ error: 'iyzico_keys_missing' }, 500);

  const { product, card } = await req.json().catch(() => ({ product: null, card: null }));
  if (!product || !(product in PRICES)) return json({ error: 'invalid_product' }, 400);
  if (!validCard(card)) return json({ error: 'invalid_card' }, 400);

  // Kullanıcı JWT'siyle çalışan istemci — auth + own-row okumalar RLS'ten geçer
  const authed = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: auth } = await authed.auth.getUser();
  if (!auth?.user) return json({ error: 'auth_required' }, 401);
  const userId = auth.user.id;
  const userEmail = auth.user.email ?? 'atlas-user@example.com';

  // Profiles'taki hassas alanları (hearts/is_premium/premium_expires_at/ads_removed)
  // yazmak için service_role gerekir — bu anahtar yalnız bu function'ın env'inde
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: profile } = await authed
    .from('profiles')
    .select('first_name, last_name, premium_expires_at')
    .eq('id', userId)
    .single();
  if (!profile) return json({ error: 'profile_not_found' }, 404);

  // Rate limit — kötüye kullanıma karşı basit fren
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: attemptsThisHour } = await service
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', hourAgo);
  if ((attemptsThisHour ?? 0) >= HOURLY_LIMIT) {
    return json({ error: 'rate_limited', limit: HOURLY_LIMIT }, 429);
  }

  const { amount, label } = PRICES[product as Product];
  const price = amount.toFixed(2);
  const conversationId = `${product}-${userId}-${Date.now()}`;
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '85.34.78.112';

  const iyzBody = {
    locale: 'tr',
    conversationId,
    price,
    paidPrice: price,
    currency: 'TRY',
    installment: '1',
    basketId: conversationId,
    paymentChannel: 'MOBILE',
    paymentGroup: 'PRODUCT',
    paymentCard: {
      cardHolderName: card.holderName.trim(),
      cardNumber: card.number.replace(/\s+/g, ''),
      expireMonth: card.expireMonth,
      expireYear: card.expireYear.length === 2 ? `20${card.expireYear}` : card.expireYear,
      cvc: card.cvc,
      registerCard: '0',
    },
    buyer: {
      id: userId,
      name: profile.first_name || 'Atlas',
      surname: profile.last_name || 'Kullanici',
      gsmNumber: '+905000000000',
      email: userEmail,
      // ⚠️ sandbox test değeri — dijital ürün olduğu için gerçek TCKN toplanmıyor
      identityNumber: '11111111111',
      registrationAddress: 'Atlas mobil uygulama kullanicisi',
      ip: clientIp,
      city: 'Istanbul',
      country: 'Turkey',
    },
    billingAddress: {
      contactName: `${profile.first_name || 'Atlas'} ${profile.last_name || 'Kullanici'}`,
      city: 'Istanbul',
      country: 'Turkey',
      address: 'Atlas mobil uygulama kullanicisi',
    },
    basketItems: [
      {
        id: product,
        name: label,
        category1: 'Atlas',
        itemType: 'VIRTUAL',
        price,
      },
    ],
  };

  const bodyString = JSON.stringify(iyzBody);
  const randomKey = `${Date.now()}${crypto.randomUUID()}`;
  const signature = await signIyzico(secretKey, randomKey, '/payment/auth', bodyString);
  const authHeader = `IYZWSv2 ${btoa(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`)}`;

  let iyz: Record<string, unknown>;
  try {
    const iyzRes = await fetch(`${baseUrl}/payment/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        'x-iyzi-rnd': randomKey,
      },
      body: bodyString,
    });
    iyz = await iyzRes.json();
  } catch (e) {
    console.error('iyzico network hatası:', e);
    return json({ error: 'payment_gateway_error' }, 502);
  }

  const success = iyz.status === 'success';

  await service.from('payments').insert({
    user_id: userId,
    product,
    amount,
    currency: 'TRY',
    status: success ? 'success' : 'failed',
    iyzico_payment_id: (iyz.paymentId as string) ?? null,
    conversation_id: conversationId,
    error_message: success ? null : ((iyz.errorMessage as string) ?? 'unknown_error'),
    raw_response: iyz,
  });

  if (!success) {
    return json({ ok: false, error: (iyz.errorMessage as string) ?? 'payment_failed' }, 402);
  }

  if (product === 'hearts_refill') {
    await service.from('profiles').update({ hearts: 5, hearts_updated_at: new Date().toISOString() }).eq('id', userId);
  } else if (product === 'ads_removed') {
    await service.from('profiles').update({ ads_removed: true }).eq('id', userId);
  } else {
    const days = product === 'premium_monthly' ? 30 : 365;
    const currentExpiry = profile.premium_expires_at ? new Date(profile.premium_expires_at) : null;
    const base = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(base.getTime() + days * 86_400_000);
    await service.from('profiles').update({ is_premium: true, premium_expires_at: newExpiry.toISOString() }).eq('id', userId);
  }

  return json({ ok: true, product });
});
