-- ============================================================
-- ATLAS — YÖK Atlas lisans program verisi (scraper: tools/yokatlas-scraper/)
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı yapıştır & çalıştır.
-- (schema.sql'den SONRA çalıştırılır; tekrar çalıştırmak güvenlidir.)
--
-- ⚠️ ÖNEMLİ KISIT (Aşama 1/2 keşfinde bulundu): `/tercih-kilavuz/search`
-- (kontenjan/yerleşen/başarı sırası kaynağı) `yil` filtresini YOK SAYIYOR —
-- yalnız GÜNCEL kılavuz dönemini (şu an 2025) döndürüyor. Ama `/netler/search`
-- (taban puan + net ortalamaları kaynağı) filtre olmadan ÇOK YILLI veri
-- döndürüyor (aynı program için 2023/2024/2025 ayrı satırlar) — yani 2023/2024
-- verisi ALINABİLİYOR, sadece o yıllarda kontenjan/yerleşen/sıra YOK, yalnız
-- taban puan + net ortalaması var. Bkz. tools/yokatlas-scraper/README.md.
--
-- Doğal anahtar `birim_id` (YÖK Atlas'ın "birimId"si) — üniversite+bölüm
-- adı+dil+burs varyasyonunun TEK, yıllar arası STABİL kimliği (doğrulandı).
-- `kilavuzKodu` kimlik olarak KULLANILMADI çünkü aynı birimGrupId+üniversite+
-- burs kombinasyonu altında bazen birden fazla ayrı birimId görülebiliyor —
-- örn. İstanbul Medipol Tıp'ta aynı görünen "Tıp (İngilizce) (Burslu)" adında
-- iki farklı kontenjan/taban puanlı satır (farklı birimId, farklı kilavuzKodu);
-- birimGrupId tek başına bunları AYIRT EDEMEZ, birimId eder. kilavuzKodu yine
-- de stats'e izlenebilirlik için ek kolon olarak yazılıyor.
-- ============================================================

create table public.yks_programs (
  id uuid primary key default gen_random_uuid(),
  birim_id bigint not null unique,        -- YÖK Atlas'ın stabil program kimliği
  birim_grup_id bigint not null,          -- bölüm adı grubu (dil/burs varyantları ortak)
  universite_id bigint not null,
  university text not null,
  university_type text,                   -- DEVLET / VAKIF
  city text,
  faculty text,                           -- fymkAdi
  department text not null,               -- birimAdi (örn. "Tıp (İngilizce) (Burslu)")
  score_type text not null check (score_type in ('SAY','EA','SOZ','DIL')),  -- lisansta TYT yok
  language text,                          -- ogrenimDiliAdi (örn. "İngilizce")
  scholarship text,                       -- bursOraniAdi (null = ücretli/devlet)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index yks_programs_universite_id_idx on public.yks_programs (universite_id);
create index yks_programs_score_type_idx on public.yks_programs (score_type);

create table public.yks_program_stats (
  program_id uuid not null references public.yks_programs(id) on delete cascade,
  year smallint not null,
  kilavuz_kodu bigint,             -- o yıla özel YÖK Atlas ID'si (izlenebilirlik/hata ayıklama)
  quota int,
  placed int,                      -- gkY (yerleşen)
  min_score numeric,
  min_rank int,
  avg_tyt_net numeric,             -- ders bazlı TYT netlerinin toplamı (hesaplanmış)
  avg_ayt_net numeric,             -- puan türüne göre ilgili AYT/YDT netlerinin toplamı (hesaplanmış)
  net_detail jsonb,                -- ham ders bazlı netler — bkz. BACKEND.md standart anahtarlar
  fee numeric,                     -- yalnız vakıf (ucret)
  primary key (program_id, year)
);

alter table public.yks_programs enable row level security;
alter table public.yks_program_stats enable row level security;

-- içerik: oturum açan herkes okur, yazma sadece service_role (scraper)
create policy "content read" on public.yks_programs      for select to authenticated using (true);
create policy "content read" on public.yks_program_stats  for select to authenticated using (true);
