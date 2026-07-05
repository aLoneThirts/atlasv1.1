-- ============================================================
-- ATLAS — ad/soyad + Google girişinde de kullanıcı adı sorulması
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (username.sql + onboarding.sql'den SONRA çalıştırılır; tekrar çalıştırmak
-- güvenlidir.)
--
-- 1) first_name/last_name kolonları — kayıt formunda toplanır (email akışı),
--    yoksa onboarding ekranında sorulur (Google akışı).
-- 2) Google ile girişte kullanıcı adı hiç sorulmuyordu (e-posta önekinden
--    otomatik türetiliyordu) — bunu ayrı bir gate açmadan, MEVCUT onboarding
--    ekranını genişleterek çözüyoruz: onboarding_completed=false olan HERKESE
--    (email veya Google fark etmez) kullanıcı adı + ad/soyad da soruluyor.
--    Yeni bir kolon/gate GEREKMEDİ — onboarding_completed zaten bu işi görüyor.
-- ============================================================

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

-- authenticated'in doğrudan yazabileceği güvenli kolonlara first_name/last_name
-- eklendi (monetization.sql'deki kısıtlamayı güncelliyoruz — hassas alanlar
-- değişmedi, yalnız yeni güvenli kolonlar eklendi).
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
  onboarding_completed
) on public.profiles to authenticated;

-- Yeni kullanıcı tetikleyicisi: first_name/last_name önce BİZİM gönderdiğimiz
-- metadata'dan (email kayıt formu), yoksa GOOGLE'IN kendi gönderdiği
-- given_name/family_name veya full_name/name'den (boşluktan bölünerek) alınır
-- — Google ile girenler onboarding'de adını yeniden yazmak zorunda kalmasın.
-- username formatı/çakışma mantığı DEĞİŞMEDİ (username.sql'deki gibi).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_raw        text;
  v_username   text;
  v_full_name  text;
  v_first_name text;
  v_last_name  text;
begin
  v_raw := lower(coalesce(new.raw_user_meta_data->>'username', split_part(coalesce(new.email, ''), '@', 1)));
  v_username := regexp_replace(v_raw, '[^a-z0-9_]', '', 'g');
  if v_username is null or length(v_username) < 3 then
    v_username := 'atlas' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  v_username := substr(v_username, 1, 20);

  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
  v_first_name := coalesce(
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'given_name',
    nullif(split_part(v_full_name, ' ', 1), '')
  );
  v_last_name := coalesce(
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'family_name',
    nullif(regexp_replace(v_full_name, '^\S+\s*', ''), '')
  );

  begin
    insert into public.profiles (id, username, first_name, last_name)
    values (new.id, v_username, v_first_name, v_last_name);
  exception when unique_violation then
    insert into public.profiles (id, username, first_name, last_name)
    values (
      new.id,
      substr(v_username, 1, 13) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
      v_first_name,
      v_last_name
    );
  end;
  return new;
end $$;
