# YÖK Atlas scraper — bulgular (Aşama 1, 2, 3)

Resmi API yok. `yokatlas.yok.gov.tr` artık bir React SPA (eski PHP tabanlı
`content/lisans-dynamic/1000_1.php` deseni **artık kullanılmıyor** — kullanıcının
verdiği ipucu eski siteye aitti, site yenilenmiş). Gerçek API,
`static/js/main.*.js` bundle'ı indirilip içinden `.concat("https://yokatlas.yok.gov.tr/api", "...")`
çağrıları çıkarılarak ve her biri gerçek isteklerle test edilerek bulundu.

**API tabanı:** `https://yokatlas.yok.gov.tr/api` — auth gerektirmiyor, CORS/rate-limit
engeli görülmedi (test sırasında istekler arası 500-600ms bekletildi).

## Doğrulanan endpoint'ler

### 1) `GET /tercih-kilavuz/universiteler`
Tüm üniversitelerin düz listesi.
```json
[{"universiteAdi":"BOĞAZİÇİ ÜNİVERSİTESİ (İSTANBUL)","universiteId":105322}, ...]
```

### 2) `GET /tercih-kilavuz/universite-programlar`
Tüm bölüm/program ADLARININ (üniversiteden bağımsız) düz listesi — filtre
dropdown'ları için.

### 3) `POST /tercih-kilavuz/search` — kontenjan/yerleşen/taban puan (YALNIZ GÜNCEL YIL)
Body: `{"filters": {"puanTuru", "birimTuruId":46}, "page": 0, "size": 500}`

`birimTuruId:46` = LİSANS (önlisans farklı ID). `size:500` doğrulandı, hızlı
(0.5s'de 2.5MB). Response: Spring-tarzı `Page` (`content`,`totalElements`).

**⚠️ `yil` filtresi TAMAMEN YOK SAYILIYOR** — `1999` dahil ne gönderirsen
gönder, dönen her satırın `yil` alanı hep güncel kılavuz dönemi (şu an 2025).
Yani bu endpoint'ten **yalnız güncel yılın** kontenjan/yerleşen/başarı sırası
alınabiliyor; geçmiş yıllar (2023/2024) BU endpoint'te YOK.

Her satırda doğrulanan alanlar:
| Alan | Anlamı |
|---|---|
| `kilavuzKodu` | Program+yıl referansı (izlenebilirlik) — **yıllar arası SABİT** kalıyor (bkz. aşağıdaki çok-yıllı keşif), doğal anahtar olarak KULLANILMADI çünkü tek başına yeterli ayırt edici değil (bkz. birimId notu) |
| `birimId` | **Doğal/stabil program kimliği** — yıllar arası stabil, üniversite+bölüm+dil+burs varyasyonunu TEK ayırt ediyor |
| `birimGrupId`,`birimGrupAdi` | Bölüm adı grubu (dil/burs varyantları arasında ORTAK — tek başına yeterli DEĞİL, bkz. Tıp örneği) |
| `universiteId`,`universiteAdi`,`uniIlAdi`(şehir) | |
| `fymkId`,`fymkAdi` | **Fakülte id/adı** (örn. "İnsani Bilimler ve Edebiyat Fakültesi") — kullanıcının istediği "fakülte" alanı bu |
| `birimAdi` | Tam ders adı, örn. "Tıp (İngilizce) (Burslu)" |
| `puanTuru`,`universiteTuru` (DEVLET/VAKIF) | |
| `ogrenimDiliId`,`ogrenimDiliAdi` | Öğretim dili (örn. "İngilizce") |
| `bursOraniId`,`bursOraniAdi` | Burs durumu — yalnız burslu/indirimli programlarda dolu (örn. "Burslu","%50 İndirimli"); devlet/ücretlide null |
| `kontenjan`,`gkY`(yerleşen) | Yalnız güncel yıl |
| `minPuan`,`basariSirasi` | Yalnız güncel yıl |
| `ucret` | (yalnız vakıf) yıllık ücret, yalnız güncel yıl |

**⚠️ Doğal anahtar sorunu — çözüldü:** İstanbul Medipol Tıp'ta AYNI
`birimGrupId` + AYNI görünen `birimAdi` ("Tıp (İngilizce) (Burslu)") ile
**iki ayrı program** bulundu (farklı `kilavuzKodu` 203110477 vs 203190967,
farklı kontenjan 10 vs 10 ama farklı `minPuan` 551.13 vs 533.83, farklı
`birimId` 256098 vs 466718). `birimGrupId` TEK BAŞINA yetersiz — **`birimId`
kullanıldı** (yıllar arası stabil olduğu ayrıca doğrulandı: aynı birimId
2023/2024/2025 sorgularında hep aynı üniversite/bölüme işaret ediyor).

`TYT` puan türü **lisansta YOK** (`birimTuruId:46`+`puanTuru:TYT` → 0 sonuç,
TYT yalnız önlisans) — scraper yalnız `SAY,EA,SÖZ,DİL` döngüsü yapıyor.

### 4) `POST /netler/search` — ders bazlı net ortalamaları (ÇOK YILLI!)
Body: `{"filters": {"puanTuru"}, "page", "size"}` — **geniş filtre yeterli,
birimGrupId/universiteId bazında TEK TEK istek atmaya GEREK YOK**, tek
sayfalamayla tüm satırlar dönüyor (doğrulandı: EA için `puanTuru` filtresi
tek başına 11284 satır döndürdü).

**⚠️ ÇOK ÖNEMLİ KEŞİF:** Bu endpoint, `/tercih-kilavuz/search`'ün aksine
**ÇOK YILLI** veri döndürüyor — aynı `kilavuzKodu` için genelde **3 ayrı
satır** (`yil: 2023, 2024, 2025`), her biri o yılın kendi `tabanPuan` ve net
ortalamalarıyla! Dağılım (SAY, 6087 benzersiz program): 4235'i tam 3 yıl,
765'i 2 yıl, 1049'u 1 yıl (muhtemelen yeni açılan programlar), 38'i 4 yıl.

**Sonuç: kullanıcının istediği 2023/2024/2025 üç yıllık veri BU API'DEN
ALINABİLİYOR** — yalnız `/tercih-kilavuz/search`'ten değil, `/netler/search`'ten.
Kontenjan/yerleşen/başarı sırası ise YALNIZ güncel yıl için mevcut (API'de
geçmiş yılların bu alanları yok) — şema ve upload.ts buna göre kuruldu: güncel
yıl satırına kontenjan/yerleşen/sıra + net_detail, geçmiş yıllara yalnız
taban puan (`tabanPuan`) + net_detail.

Doğrulanan ders-net alan adları (puan türüne göre farklı dersler dönüyor):
- Her zaman: `tytTrkNet`, `tytSosNet`, `tytMatNet`, `tytFenNet`
- `SAY`: + `aytMatNet`, `aytFizNet`, `aytKimNet`, `aytBioNet`
- `EA`: + `aytMatNet`, `aytTdeNet` (edebiyat), `aytTrh1Net`, `aytCog1Net`
- `SÖZ`: + `aytTdeNet`, `aytTrh1Net`, `aytCog1Net`, `aytTrh2Net`, `aytCog2Net`, `aytFelNet`, `aytDinNet`
- `DİL`: + `ydtYdilNet` (YDT neti — BACKEND.md'deki `ydt` anahtarıyla eşleşiyor)

Standart `net_detail` anahtarlarına eşleme (BACKEND.md ile aynı sözlük) —
bkz. `_shared.ts` içindeki `NET_FIELD_MAP`. "Yerleşenlerin ortalama TYT/AYT
neti" (toplam net) doğrudan bir alan olarak YOK — ders bazlı netlerden
`buildNetDetail()` ile hesaplanıyor.

Ayrıca: `tabanPuan`, `obp`, `katsayi`.

## Bulunamayan / doğrulanamayan

Site arayüzünde "Öğrenci Profili" bölümü var (cinsiyet dağılımı, coğrafi
bölge, yeni/eski mezun oranı) ama bunu dolduran ayrı bir endpoint
**bulunamadı** (bundle'da toplam 8 benzersiz taban yol var, hepsi incelendi:
yukarıdaki 4 + `/auth/*` x5, `/tercih-listesi*` x3, `/yokakademik-redirect`,
`/net-sihirbazi`). Muhtemelen kaldırılmış bir özellik ya da login gerektiren
bir akıştan geliyor. **Kullanıcının istediği hiçbir zorunlu alanı
etkilemiyor** — atlanabilir.

## Puan-Sıra Dağılımı (görev listesi madde 9 — araştırma SONUCU)

**Sonuç: ÖSYM resmi "Puanların ve Sıralamaların Dağılımı" tablosunu artık
AYRI bir belge olarak yayınlamıyor (en azından bulunabilir/erişilebilir
şekilde değil) — ama buna ihtiyacımız yok, çünkü kendi topladığımız veride
zaten var.**

### Denenen resmi kaynaklar (ikisi de YANLIŞ çıktı)
1. `https://dokuman.osym.gov.tr/pdfdokuman/2025/YKS/sayisalbilgiler_tayd21072025.pdf`
   ("2025-YKS Sınav Sonuçlarına İlişkin Sayısal Bilgiler") — yalnız ham
   **doğru cevap sayısı** dağılım grafikleri (ders bazlı, örn. "TYT Türkçe
   Doğru Cevap Sayısı Dağılımı"). Puan/sıra yok.
2. `https://dokuman.osym.gov.tr/pdfdokuman/2025/YKS/YERLEST%C4%B0RME/sayisalbilgiler_ykd25082025.pdf`
   ("2025-YKS Yerleştirme Sonuçlarına İlişkin Sayısal Bilgiler" — dikkat:
   klasör adı `YERLESTİRME`, `YERLEŞTİRME` DEĞİL; ilk denemede yanlış harf
   yüzünden ÖSYM'nin WAF'ı "Erişim Engellendi" sahte-403 sayfası döndürdü,
   gerçek bir bot engeli değilmiş) — yalnız toplam kontenjan/yerleşen/boş
   sayıları (okul türü, öğrenim durumu bazında), TABLO-3/4 (.xlsx, aynı
   klasörde, aynı isim çözümüyle erişilebilir olmalı — denenmedi) "En
   Küçük/Büyük Puanlar" içeriyor olabilir ama bunlar da puan-BAŞARISI
   SIRASI eşlemesi değil.

Üçüncü parti "puan hesaplama" siteleri (ertansinansahin.com, kariyer.net,
puango.net vb.) sıralama tahmini sunuyor ama kaynaklarını açıklamıyorlar —
resmi/doğrulanabilir değil, kaynak olarak KULLANILMADI.

### Gerçek çözüm: kendi verimiz zaten bu dağılımı içeriyor
`yks_program_stats` tablosu (görev 8'de dolduruldu) her program+yıl için
`min_score` (taban puan) + `min_rank` (taban başarı sırası) çifti tutuyor —
**12.063 program × 3 yıl ≈ 32 bin gerçek (puan, sıra) noktası**, `score_type`
bazında gruplanabilir. Bu, ÖSYM'nin resmi dağılım tablosundan DAHA GRANÜLER
bir ampirik puan-sıra eğrisi verir (binlerce gerçek kesişim noktası).

**Önerilen plan (görev 12 — rank-estimator.ts için de temel):**
```sql
select year, score_type, min_score as score, min_rank as rank
from yks_program_stats jps join yks_programs p on p.id = jps.program_id
where min_score is not null and min_rank is not null
order by year, score_type, min_score;
```
Bu sorgunun sonucu doğrudan `score_rank_distribution(year, score_type, score,
rank)` tablosuna yazılabilir — ayrı bir scraper/parser YAZILMASINA GEREK YOK,
mevcut `yks_programs`/`yks_program_stats` üzerinde bir SQL view veya tek
seferlik `insert into ... select` yeterli. `rank-estimator.ts`'in lineer
interpolasyonu bu yoğun nokta bulutu üzerinde çalışabilir.

**Kapsanan yıllar:** 2023, 2024, 2025 (zaten scrape edilen veriyle sınırlı —
2021/2022 için ayrı bir YÖK Atlas/ÖSYM kaynağı gerekir, bulunamadı; kullanıcı
gerekirse ayrıca isteyebilir).

## Aşama 2/3 — kod tamam, TAM ÇALIŞTIRMA onay bekliyor

- **`collect-ids.ts`** — `puanTuru` döngüsü (`SAY,EA,SÖZ,DİL`) ile
  `/tercih-kilavuz/search`i `size:500` sayfalar, checkpoint `program_ids.json`'a
  yazar (kaldığı yerden devam edebilir — tamamlanmış puan türleri atlanır).
  **Gerçekten tam çalıştırıldı: 12.265 program satırı** (SAY 5653, EA 3987,
  SÖZ 1948, DİL 677) — birkaç dakikada bitti, engel yenmedi.
- **`scrape-details.ts`** — aynı döngüyle `/netler/search`i sayfalar (geniş
  filtre, per-program istek YOK). **Gerçekten tam çalıştırıldı: 34.590 net
  satırı** (çok yıllı olduğu için program sayısından fazla).
- **`upload.ts`** — iki checkpoint'i `kilavuzKodu`+`yil` ile join eder,
  `yks_programs` (`birim_id` doğal anahtar) + `yks_program_stats`
  (`program_id`,`year`) tablolarına 500'erli batch upsert (@supabase/supabase-js,
  npm: import). Güncel yıla kontenjan/yerleşen/sıra + net_detail, geçmiş
  yıllara yalnız taban puan + net_detail yazılır.
- **Şema:** `supabase/yks_programs.sql` yazıldı (schema.sql'e dokunulmadı —
  repo konvansiyonu, bkz. supabase/README.md). RLS: authenticated okur,
  yazma yalnız service_role.
- **Test:** 6 gerçek program (Medipol Tıp'ın 2 çakışan varyantı dahil) küçük
  bir alt kümeyle `upload.ts` gerçekten çalıştırıldı — **`yks_programs`
  tablosu henüz Supabase'de yok** (`Could not find the table
  'public.yks_programs' in the schema cache`), çünkü service_role anahtarı
  yalnız REST/PostgREST erişimi veriyor, DDL (CREATE TABLE) çalıştıramıyor.
  **Kullanıcı `supabase/yks_programs.sql`'i SQL Editor'de çalıştırdıktan
  sonra upload küçük alt kümeyle tekrar denenmeli, sonra tam ölçekli
  çalıştırılabilir.**
- Rate limit: 500-600ms'de hiç engel yenmedi; 3 deneme + exponential backoff
  `_shared.ts → postWithRetry()`'de var.
- Tüm pipeline (12.265 program + 34.590 net satırı) toplamda ~85 sayfalama
  isteğiyle (`collect-ids`: 26 sayfa, `scrape-details`: 70 sayfa) birkaç
  dakikada tamamlanıyor — performans riski yok, ama gerçek prod DB'ye ~12 bin
  satır (+ ~30 bin stats satırı) yazacağından kullanıcı onayı bekleniyor.
- `program_ids.json` / `net_details.json` büyük (24-63MB) — `.gitignore`'a
  eklendi, repoya girmez.

## discover.ts — çalıştırıldı, doğrulandı
`deno task discover` — Boğaziçi İktisat (EA) ve İstanbul Medipol Tıp (SAY)
için iki endpoint'i gerçekten çekip `kilavuzKodu` ile birleştiriyor, sonucu
konsola yazdırıyor. Deno bu makineye kuruldu (`winget install DenoLand.Deno`,
v2.9.1).
