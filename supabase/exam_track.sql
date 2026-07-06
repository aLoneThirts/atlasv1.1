-- ============================================================
-- ATLAS — sınav kapsamı seçimi (TYT / TYT+AYT-EA)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql + monetization.sql'den SONRA çalıştırılır; tekrar çalıştırmak
-- güvenlidir.)
--
-- `profiles.exam_track` schema.sql'de zaten vardı (BACKEND.md §3: "kullanıcı
-- onboarding'de seçer") ama hiçbir ekran bunu topluyor/yazmıyordu — kolon
-- monetization.sql'deki client update GRANT'ından da bilerek dışarıda
-- bırakılmıştı (hassas alan muamelesi, hearts/streak gibi). Bu dosya
-- dev_set_premium ile aynı düzende bir SECURITY DEFINER RPC ekliyor;
-- kolon yine client'tan doğrudan UPDATE edilemez, yalnız bu RPC üzerinden
-- (kullanıcının kendi satırıyla sınırlı) değişebilir.
-- ============================================================

create or replace function public.set_exam_track(new_track text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_track not in ('tyt', 'tyt_ayt_ea') then
    raise exception 'invalid exam_track: %', new_track;
  end if;
  update profiles set exam_track = new_track where id = auth.uid();
end $$;

grant execute on function public.set_exam_track(text) to authenticated;
