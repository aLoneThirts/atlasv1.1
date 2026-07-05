-- ============================================================
-- ATLAS — Puan-Sıra Dağılımı (görev listesi madde 9)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (yks_programs.sql'den VE yks_programs/yks_program_stats doldurulduktan
-- SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- ARAŞTIRMA SONUCU (bkz. tools/yokatlas-scraper/README.md "Puan-Sıra Dağılımı"
-- bölümü): ÖSYM'nin ayrı yayınladığı resmi "Puanların ve Sıralamaların
-- Dağılımı" belgesi artık erişilebilir/bulunabilir değil (denenen PDF'ler
-- yalnız toplam kontenjan/doğru-cevap-sayısı istatistikleri içeriyor, puan↔sıra
-- eşlemesi yok). AYRI BİR SCRAPER GEREKMEDİ — kendi topladığımız
-- yks_program_stats zaten her program+yıl için (min_score, min_rank) çifti
-- tutuyor; bu, ~32 bin gerçek noktadan oluşan, resmi tablodan DAHA GRANÜLER
-- bir ampirik puan-sıra eğrisi veriyor. rank-estimator.ts (görev 12) bunun
-- üzerinde lineer interpolasyon yapacak.
--
-- VIEW olarak kuruldu (kopya tablo değil) — yks_program_stats her scrape'te
-- güncellenince otomatik senkron kalır, ayrı bir yazma/senkron adımı gerekmez.
-- Kapsanan yıllar: yalnız yks_program_stats'te veri olan yıllar (şu an 2023-2025).
-- ============================================================

create or replace view public.score_rank_distribution
with (security_invoker = true) as
select
  s.year,
  p.score_type,
  s.min_score as score,
  s.min_rank as rank
from public.yks_program_stats s
join public.yks_programs p on p.id = s.program_id
where s.min_score is not null and s.min_rank is not null;

grant select on public.score_rank_distribution to authenticated;
