-- ============================================================
-- ATLAS — ücretli can doldurma (BACKEND.md §4.1 kuralı değişti)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql + finish_quiz.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- ESKİ KURAL: premium kullanıcıda can hiç düşmezdi (sınırsız).
-- YENİ KURAL: can herkeste 0-5 arası sınırlı (finish_quiz.sql'de düzeltildi).
-- Ekstra can artık gerçek parayla satın alınıyor — RevenueCat (veya App Store/
-- Play Store IAP) üzerinden bir "tüketilebilir" (consumable) ürün olarak.
-- Satın alma tipi: ANLIK TAM DOLDURMA (5/5) — kapasite tavanı aşılmıyor.
--
-- Bu RPC, gerçek satın alma onaylandıktan SONRA çağrılır. Satın alma
-- doğrulamasının kendisi burada YAPILMAZ — client, RevenueCat/store
-- makbuzunu kendi tarafında doğruladıktan sonra bu RPC'yi çağırır.
-- ⚠️ v1'de gerçek IAP altyapısı henüz kurulmadı (RevenueCat/App Store/Play
-- Console hesapları hazır değil) — bkz. atlas-mobile/src/lib/purchases.ts
-- içindeki placeholder + uyarı. Gerçek mağaza ürünleri tanımlanınca o dosya
-- güncellenecek, bu RPC'nin sözleşmesi DEĞİŞMEYECEK.
-- ============================================================

create or replace function public.refill_hearts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  update profiles
     set hearts = 5,
         hearts_updated_at = now()
   where id = v_user;

  return jsonb_build_object('hearts', 5);
end $$;

grant execute on function public.refill_hearts() to authenticated;
