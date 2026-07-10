-- ============================================================
-- ATLAS — KVKK/Kullanım Şartları onayı
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA; tekrar çalıştırmak güvenlidir.)
--
-- Hedef kitle 16-19 yaş, bazı kullanıcılar reşit değil. Onboarding ekranı
-- artık Kullanım Şartları/Gizlilik Politikası'nı kabul zorunlu bir checkbox
-- gösteriyor (bkz. atlas-mobile/src/app/onboarding.tsx,
-- atlas-mobile/src/app/hukuki.tsx) — bu kolon o onayın ne zaman verildiğini
-- tutar (denetim/kanıt amaçlı; null = henüz onaylamadı).
-- ============================================================

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

revoke update on public.profiles from authenticated;
grant update (
  username,
  first_name,
  last_name,
  target_university,
  target_department,
  exam_date,
  daily_xp_goal,
  expo_push_token,
  onboarding_completed,
  terms_accepted_at
) on public.profiles to authenticated;
