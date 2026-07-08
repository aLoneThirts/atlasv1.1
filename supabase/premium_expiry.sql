-- ============================================================
-- ATLAS — premium süresi (BACKEND.md §4.9, §6.6 — iyzico entegrasyonu)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql + monetization.sql'den SONRA; tekrar çalıştırmak güvenlidir.)
--
-- iyzico ile satın alınan abonelikler süreli: premium_expires_at dolunca
-- expire-premium Edge Function'ı (günlük cron, bkz. supabase/README.md)
-- is_premium'u false'a çeker. Kolon istemciden YAZILAMAZ (monetization.sql'deki
-- grant update (...) listesine dahil değil — yalnız service_role/iyzico-pay
-- Edge Function ve expire-premium yazar).
-- ============================================================

alter table public.profiles
  add column if not exists premium_expires_at timestamptz;
