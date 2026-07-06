-- ============================================================
-- ATLAS — okul/bölüm arama, Türkçe İ/I harf sorunu düzeltmesi
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (yks_programs.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- BUG: yks_programs.university/department büyük harfli Türkçe metin
-- içeriyor (örn. "İSTANBUL MEDİPOL ÜNİVERSİTESİ"). Veritabanının varsayılan
-- (Türkçe olmayan) locale'inde `lower('İSTANBUL')` "istanbul" ÜRETMİYOR
-- (İ harfi doğru küçültülmüyor) — bu yüzden client'taki düz `ilike`
-- kullanıcı "istanbul" yazınca hiç sonuç bulamıyordu (test edildi, doğrulandı).
--
-- ÇÖZÜM: arama SIRASINDA İ/I/ı harflerini TEK bir forma (i) indirgeyip
-- öyle karşılaştıran bir RPC — sonuçta gösterilen university/department
-- metni DEĞİŞMİYOR, yalnız arama eşleştirmesi bu normalize edilmiş
-- kopya üzerinden yapılıyor.
-- ============================================================

create or replace function public.turkish_casefold(input text)
returns text
language sql
immutable
as $$
  select lower(replace(replace(replace(coalesce(input, ''), 'İ', 'i'), 'I', 'i'), 'ı', 'i'));
$$;

create or replace function public.search_yks_programs(q_university text default '', q_department text default '')
returns setof yks_programs
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from yks_programs
  where (q_university = '' or turkish_casefold(university) like '%' || turkish_casefold(q_university) || '%')
    and (q_department = '' or turkish_casefold(department) like '%' || turkish_casefold(q_department) || '%')
  order by university, department
  limit 30;
$$;

grant execute on function public.turkish_casefold(text) to authenticated;
grant execute on function public.search_yks_programs(text, text) to authenticated;
