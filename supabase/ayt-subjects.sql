-- ============================================================
-- ATLAS — AYT-EA ders kayıtları (BACKEND.md §3, §9 madde 4 — "AYT v1'e girsin mi?" EVET karar verildi)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA; tekrar çalıştırmak güvenlidir — id çakışırsa no-op.)
--
-- schema.sql'de yalnız 'edebiyat' AYT dersi vardı; Tarih/Coğrafya/Felsefe'nin
-- AYT sürümleri hiç kayıtlı değildi (TYT sürümleriyle aynı id'yi paylaşamazlar
-- çünkü konu ağaçları/ilerlemesi ayrı — prototipteki MAP_DATA.ayt.castles
-- 'tarih2'/'cograf2'/'felsefe2' id'leriyle aynı ayrım).
-- ============================================================

insert into public.subjects (id, name, emoji, color, color_dark, exam_type, is_free, sort_order) values
  ('tarih_ayt',    'Tarih (AYT)',    '⚔️', '#E67E22', '#A04000', 'ayt', false, 11),
  ('cografya_ayt', 'Coğrafya (AYT)', '🌍', '#27AE60', '#145A32', 'ayt', false, 12),
  ('felsefe_ayt',  'Felsefe (AYT)',  '🧠', '#8E44AD', '#5B2C73', 'ayt', false, 13)
on conflict (id) do nothing;
