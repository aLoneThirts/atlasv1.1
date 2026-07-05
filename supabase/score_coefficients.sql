-- ============================================================
-- ATLAS — ÖSYM YKS puan hesaplama şeması (görev listesi madde 10)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- Formül tek kaynakta: shared/yks-calc.ts (hem atlas-mobile hem
-- supabase/functions/calculate-yks-score bunu kullanır). Bu dosya yalnız
-- veriyi (katsayılar + kullanıcı sonuçları) tutar.
-- ============================================================

create table if not exists public.score_coefficients (
  year          smallint not null,
  score_type    text not null check (score_type in ('TYT','SAY','EA','SOZ','DIL')),
  base_score    numeric not null,       -- puan türünün sabit başlangıç değeri
  coefficients  jsonb not null,         -- {"tyt_turkce":1.2,"ayt_mat":2.89,...} — standart anahtarlar shared/yks-calc.ts'te dokümante
  primary key (year, score_type)
);

alter table public.score_coefficients enable row level security;
drop policy if exists "content read" on public.score_coefficients;
create policy "content read" on public.score_coefficients for select to authenticated using (true);

-- ⚠️⚠️⚠️ PLACEHOLDER KATSAYILAR ⚠️⚠️⚠️
-- Aşağıdaki base_score ve coefficients değerleri GERÇEK DEĞİL — bilinçli
-- olarak apaçık sahte/yuvarlak sayılar seçildi (TYT dersleri 1.0, AYT/YDT
-- dersleri 2.0, base_score 100) ki biri gerçek zannedip kullanmasın.
-- ÖSYM'nin resmi kılavuzundaki GERÇEK katsayılar (yıl+puan türü başına
-- farklıdır, standart sapmaya göre hesaplanır) buraya girilmeden bu tabloyla
-- ÜRETİMDE puan hesaplama YAPILMAMALI. Yalnız şemayı/akışı test etmek içindir.
insert into public.score_coefficients (year, score_type, base_score, coefficients) values
  (2023, 'TYT', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0}'),
  (2024, 'TYT', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0}'),
  (2025, 'TYT', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0}'),

  (2023, 'SAY', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_matematik":2.0,"ayt_fizik":2.0,"ayt_kimya":2.0,"ayt_biyoloji":2.0}'),
  (2024, 'SAY', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_matematik":2.0,"ayt_fizik":2.0,"ayt_kimya":2.0,"ayt_biyoloji":2.0}'),
  (2025, 'SAY', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_matematik":2.0,"ayt_fizik":2.0,"ayt_kimya":2.0,"ayt_biyoloji":2.0}'),

  (2023, 'EA', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_matematik":2.0,"ayt_edebiyat":2.0,"ayt_tarih1":2.0,"ayt_cografya1":2.0}'),
  (2024, 'EA', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_matematik":2.0,"ayt_edebiyat":2.0,"ayt_tarih1":2.0,"ayt_cografya1":2.0}'),
  (2025, 'EA', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_matematik":2.0,"ayt_edebiyat":2.0,"ayt_tarih1":2.0,"ayt_cografya1":2.0}'),

  (2023, 'SOZ', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_edebiyat":2.0,"ayt_tarih1":2.0,"ayt_cografya1":2.0,"ayt_tarih2":2.0,"ayt_cografya2":2.0,"ayt_felsefe":2.0,"ayt_dkab":2.0}'),
  (2024, 'SOZ', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_edebiyat":2.0,"ayt_tarih1":2.0,"ayt_cografya1":2.0,"ayt_tarih2":2.0,"ayt_cografya2":2.0,"ayt_felsefe":2.0,"ayt_dkab":2.0}'),
  (2025, 'SOZ', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ayt_edebiyat":2.0,"ayt_tarih1":2.0,"ayt_cografya1":2.0,"ayt_tarih2":2.0,"ayt_cografya2":2.0,"ayt_felsefe":2.0,"ayt_dkab":2.0}'),

  (2023, 'DIL', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ydt":2.0}'),
  (2024, 'DIL', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ydt":2.0}'),
  (2025, 'DIL', 100, '{"tyt_turkce":1.0,"tyt_sosyal":1.0,"tyt_matematik":1.0,"tyt_fen":1.0,"ydt":2.0}')
on conflict (year, score_type) do nothing;

-- ------------------------------------------------------------
-- Kullanıcının kaydettiği puan hesaplama sonuçları (koç analizi bunu okur).
-- Yazma yalnız calculate-yks-score Edge Function'ı üzerinden olur (kullanıcının
-- kendi JWT'siyle, RLS "own row" zaten yeterli — ekstra kısıtlama gerekmez,
-- bu veri kullanıcının kendi girdiği/hesapladığı, ayrıcalık vermiyor).
-- ------------------------------------------------------------
create table if not exists public.user_exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year smallint not null,
  score_type text not null check (score_type in ('TYT','SAY','EA','SOZ','DIL')),
  net_detail jsonb not null,           -- ders bazlı netler (standart anahtarlar)
  ham_puan numeric not null,
  obp numeric,
  onceki_yil_yerlesti boolean not null default false,
  yerlestirme_puani numeric not null,
  created_at timestamptz not null default now()
);

alter table public.user_exam_results enable row level security;
drop policy if exists "own exam results" on public.user_exam_results;
create policy "own exam results" on public.user_exam_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
