-- ============================================================
-- ATLAS — Tercih Robotu: sıralama ARALIĞI sorgusu (2026-07-14 revizyonu)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (yks_programs.sql + yks_programs_search.sql'den SONRA çalıştırılır —
--  turkish_casefold() ve yks_programs/yks_program_stats tablolarına bağımlı.
--  Tekrar çalıştırmak güvenlidir: create or replace + idempotent grant.)
--
-- Eski tercih_oner() (tek sıra/puan + risk bandı) yerine daha basit ve
-- kullanıcının doğrudan anladığı bir model: "en düşük sıralamam X, en
-- yüksek (en kötü) sıralamam Y — bu aralıktaki taban sıraya sahip TÜM
-- programları listele". Risk sınıflandırması yok, puan girişi yok —
-- yalnız sıra aralığı + mevcut filtreler (puan türü/şehir/üniversite
-- türü/program-üniversite arama).
--
-- ⚠️ VERİ KISITI (değişmedi, bkz. tercih_robotu.sql): min_rank (taban
-- başarı sırası) YÖK Atlas'ta yalnız GÜNCEL yıl (2025) için var; geçmiş
-- yıllarda (2023/2024) yalnız min_score var, min_rank NULL — bu yüzden
-- bu fonksiyon yalnız min_rank dolu satırları döndürür ve p_year
-- varsayılan 2025'tir. Başka bir yıl verilirse (rank verisi olmayan)
-- sonuç boş döner (hata değil).
-- ============================================================

create or replace function public.tercih_sira_araligi(
  p_rank_min         int,
  p_rank_max         int,
  p_year             int     default 2025,
  p_score_type       text    default null,   -- 'SAY'|'EA'|'SOZ'|'DIL' | null=hepsi
  p_city             text    default null,   -- şehir (turkish_casefold içeren eşleşme) | null=hepsi
  p_university_type  text    default null,   -- 'DEVLET'|'VAKIF' | null=hepsi
  p_q_program        text    default '',     -- program/bölüm ara
  p_q_university     text    default '',     -- üniversite ara
  p_limit            int     default 100
)
returns table (
  program_id      uuid,
  university      text,
  university_type text,
  city            text,
  faculty         text,
  department      text,
  score_type      text,
  language        text,
  scholarship     text,
  year            smallint,
  min_score       numeric,
  min_rank        int,
  quota           int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.university, p.university_type, p.city, p.faculty, p.department,
    p.score_type, p.language, p.scholarship,
    s.year, s.min_score, s.min_rank, s.quota
  from public.yks_programs p
  join public.yks_program_stats s
    on s.program_id = p.id and s.year = p_year
  where s.min_rank is not null
    and s.min_rank between least(p_rank_min, p_rank_max) and greatest(p_rank_min, p_rank_max)
    and (p_score_type is null or p_score_type = '' or p.score_type = p_score_type)
    and (p_city is null or p_city = '' or turkish_casefold(p.city) like '%' || turkish_casefold(p_city) || '%')
    and (p_university_type is null or p_university_type = '' or p.university_type = p_university_type)
    and (p_q_program = '' or turkish_casefold(p.department) like '%' || turkish_casefold(p_q_program) || '%')
    and (p_q_university = '' or turkish_casefold(p.university) like '%' || turkish_casefold(p_q_university) || '%')
  order by s.min_rank asc
  limit greatest(1, least(coalesce(p_limit, 100), 300));
$$;

grant execute on function public.tercih_sira_araligi(
  int, int, int, text, text, text, text, text, int
) to authenticated;
