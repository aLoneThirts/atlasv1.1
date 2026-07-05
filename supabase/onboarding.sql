-- ============================================================
-- ATLAS — ilk giriş onboarding'i (hedef okul/bölüm)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- target_university/target_department schema.sql'de zaten vardı ama hiçbir
-- ekran bunları toplamıyordu. Bu kolon, kullanıcının onboarding akışını
-- (ilk girişte göster / atlanabilir / ayarlardan tekrar erişilebilir)
-- görüp görmediğini tutar — alanları boş bırakıp atlaması da "tamamlandı" sayılır.
-- ============================================================

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;
