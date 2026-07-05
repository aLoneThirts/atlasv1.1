-- ============================================================
-- ATLAS — premium/reklamsız satın alma + kolon bazlı yazma kilidi
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- GÜVENLİK NOTU: profiles RLS'i ("own profile") yalnız SATIR sahipliğini
-- kontrol ediyor, KOLON bazlı değil — yani şu ana kadar herhangi bir
-- authenticated kullanıcı kendi satırında `is_premium: true` yazıp bedava
-- premium/can/streak verebilirdi (client'tan direkt update ile). Bu dosya
-- authenticated'in profiles'ta yazabileceği kolonları GRANT ile daraltıyor;
-- hassas alanlar (is_premium, ads_removed, hearts, streak_*, exam_track)
-- yalnız SECURITY DEFINER RPC'ler (finish_quiz, refill_hearts, aşağıdakiler)
-- üzerinden değişebilir.
-- ============================================================

alter table public.profiles
  add column if not exists ads_removed boolean not null default false;

-- Client'ın doğrudan UPDATE edebileceği kolonları daralt (hassas olmayanlar).
revoke update on public.profiles from authenticated;
grant update (
  username,
  target_university,
  target_department,
  exam_date,
  daily_xp_goal,
  expo_push_token,
  onboarding_completed
) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- v1 PLACEHOLDER — gerçek RevenueCat webhook'u kurulunca bu iki RPC yerini
-- bir Edge Function'a (webhook handler, service_role ile) bırakacak; o zaman
-- client bu RPC'leri hiç çağırmayacak. Şimdilik atlas-mobile/src/lib/purchases.ts
-- "test modu" uyarısıyla bunları çağırıyor (gerçek ödeme doğrulaması YOK).
-- ------------------------------------------------------------

create or replace function public.dev_set_premium(active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set is_premium = active where id = auth.uid();
end $$;

grant execute on function public.dev_set_premium(boolean) to authenticated;

create or replace function public.dev_set_ads_removed(active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set ads_removed = active where id = auth.uid();
end $$;

grant execute on function public.dev_set_ads_removed(boolean) to authenticated;
