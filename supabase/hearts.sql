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

-- ============================================================
-- KARAR DEĞİŞTİ (2026-07-08, Göktuğ): zamanla can yenileme KALDIRILDI.
-- Bir önceki sürümde buraya 8 saatte 1 can yenileyen calc_regen_hearts()/
-- get_hearts() eklenmişti — test edilince İSTENMEDİ: can yalnız satın
-- alarak (refill_hearts, iyzico-pay üzerinden) geri gelecek, kendiliğinden
-- ASLA yenilenmeyecek. Zaten tek/global bir can havuzu var (profiles.hearts,
-- 7 ders için ortak) — ders bazlı ayrı bir can sistemi yok ve olmayacak.
-- Önceden bu dosyayı çalıştırmış olan projelerde aşağıdaki drop'lar o eski
-- fonksiyonları temizler.
-- ============================================================

drop function if exists public.get_hearts();
drop function if exists public.calc_regen_hearts(int, timestamptz);

-- ============================================================
-- lose_heart() — can ANINDA (quiz bitmeden) düşer (2026-07-08 düzeltmesi).
-- Önceden can yalnız quiz TAMAMLANINCA finish_quiz içinde toplu düşüyordu;
-- bu yüzden kullanıcı quiz'i canı biterek yarıda bırakırsa (hiç finish_quiz
-- çağrılmadan) DB'deki can hiç değişmiyordu — sonra tekrar aynı/yüksek can
-- görünmesi ("can geri geldi" gibi bir bug) buradan kaynaklanıyordu.
-- Artık her yanlış cevapta client bu RPC'yi çağırıyor, kayıp anında kalıcı
-- oluyor. finish_quiz artık canı DÜŞÜRMÜYOR, yalnız günceli okuyup raporluyor.
-- ============================================================

create or replace function public.lose_heart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_hearts int;
begin
  if v_user is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  update profiles
     set hearts = greatest(0, hearts - 1),
         hearts_updated_at = now()
   where id = v_user
  returning hearts into v_hearts;

  if not found then
    raise exception 'profile_not_found';
  end if;

  return jsonb_build_object('hearts', v_hearts);
end $$;

grant execute on function public.lose_heart() to authenticated;
