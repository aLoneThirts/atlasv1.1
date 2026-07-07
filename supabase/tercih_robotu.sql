-- ============================================================
-- ATLAS — Tercih Robotu (madde 3: sıra/puan + filtre → risk sınıflı öneriler)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (yks_programs.sql VE yks_programs_search.sql'den SONRA çalıştırılır —
--  turkish_casefold() ile yks_programs/yks_program_stats tablolarına bağımlı.
--  Tekrar çalıştırmak güvenlidir: create or replace + idempotent grant.)
--
-- Kullanıcı YA sırasını (p_rank) YA puanını (p_score) girer; robot her programın
-- o yılki taban sıra/puanıyla kıyaslayıp 3 risk seviyesine ayırır:
--   🟢 guvenli  — kullanıcı tabandan belirgin daha iyi (rahat tutturur)
--   🟡 dengeli  — taban civarı
--   🔴 riskli   — tabanın biraz altında ama ulaşılabilir
-- Bantların DIŞINDA kalanlar döndürülmez (güvenli zaten "kolay"ı kapsıyor;
-- riskli bandının ötesi = pratikte erişilemez).
--
-- ⚠️ VERİ NOTU: min_rank (taban başarı sırası) YÖK Atlas'ta yalnız GÜNCEL yıl
-- (2025) için var; geçmiş yıllarda yalnız min_score (taban puan). Dolayısıyla:
--   • p_rank ile arama  → pratikte yalnız 2025 sonuç verir
--   • p_score ile arama → 2023/2024/2025 hepsinde çalışır
-- (Geçmiş yıl sırası + TYT/önlisans sırası madde 2c'nin 2. adımında —
--  önlisans scrape'i / resmi ÖSYM puan-sıra tablosuyla — eklenecek.)
--
-- Risk bant eşikleri bir ÜRÜN kararıdır; tek yerde (aşağıdaki CASE'lerde)
-- tanımlı ve ayarlanabilir. rank oranı: 0.90 / 1.10 / 1.35; puan farkı: +2 / -2 / -8.
-- ============================================================

create or replace function public.tercih_oner(
  p_score_type       text    default null,   -- 'SAY'|'EA'|'SOZ'|'DIL' | null=hepsi
  p_year             int     default 2025,
  p_rank             int     default null,    -- kullanıcı başarı sırası (öncelikli)
  p_score            numeric default null,    -- veya yerleştirme puanı
  p_risk             text    default null,    -- 'guvenli'|'dengeli'|'riskli' | null=hepsi
  p_city             text    default null,    -- şehir (turkish_casefold içeren eşleşme) | null=hepsi
  p_university_type  text    default null,    -- 'DEVLET'|'VAKIF' | null=hepsi
  p_q_program        text    default '',      -- program/bölüm ara
  p_q_university     text    default '',      -- üniversite ara
  p_include_onlisans boolean default false,   -- ileri uyumluluk: şu an veri yalnız lisans (etkisiz)
  p_limit            int     default 50
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
  quota           int,
  risk            text,
  gap             numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with scored as (
    select
      p.id, p.university, p.university_type, p.city, p.faculty, p.department,
      p.score_type, p.language, p.scholarship,
      s.year, s.min_score, s.min_rank, s.quota,
      case
        -- Sıra öncelikli (düşük sıra = daha iyi): kullanıcı/taban oranı
        when p_rank is not null and s.min_rank is not null then
          case
            when p_rank <= s.min_rank * 0.90 then 'guvenli'
            when p_rank <= s.min_rank * 1.10 then 'dengeli'
            when p_rank <= s.min_rank * 1.35 then 'riskli'
          end
        -- Sıra yoksa puan (yüksek puan = daha iyi): kullanıcı - taban farkı
        when p_score is not null and s.min_score is not null then
          case
            when p_score - s.min_score >=  2 then 'guvenli'
            when p_score - s.min_score >= -2 then 'dengeli'
            when p_score - s.min_score >= -8 then 'riskli'
          end
      end as risk,
      case
        when p_rank is not null and s.min_rank is not null then abs(p_rank - s.min_rank)::numeric
        when p_score is not null and s.min_score is not null then abs(p_score - s.min_score)
      end as gap
    from public.yks_programs p
    join public.yks_program_stats s
      on s.program_id = p.id and s.year = p_year
    where (p_score_type is null or p_score_type = '' or p.score_type = p_score_type)
      and (p_city is null or p_city = '' or turkish_casefold(p.city) like '%' || turkish_casefold(p_city) || '%')
      and (p_university_type is null or p_university_type = '' or p.university_type = p_university_type)
      and (p_q_program = '' or turkish_casefold(p.department) like '%' || turkish_casefold(p_q_program) || '%')
      and (p_q_university = '' or turkish_casefold(p.university) like '%' || turkish_casefold(p_q_university) || '%')
  )
  select
    id, university, university_type, city, faculty, department,
    score_type, language, scholarship, year, min_score, min_rank, quota, risk, gap
  from scored
  where risk is not null
    and (p_risk is null or p_risk = '' or risk = p_risk)
  order by
    case risk when 'guvenli' then 0 when 'dengeli' then 1 else 2 end,
    gap asc nulls last
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

grant execute on function public.tercih_oner(
  text, int, int, numeric, text, text, text, text, text, boolean, int
) to authenticated;
