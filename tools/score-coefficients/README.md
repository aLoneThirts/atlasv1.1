# score_coefficients — gerçek ÖSYM katsayılarını elle doldurma

`supabase/score_coefficients.sql`'deki değerler bilinçli olarak sahte
(TYT dersleri 1.0, AYT/YDT dersleri 2.0, base_score 100) — ÖSYM'nin bu
katsayıları yayınladığı bir API yok, YÖK Atlas scraper'ı bunu HİÇBİR
ZAMAN çekemez. Tek yol: ÖSYM'nin o yılın resmi kılavuzunda ("Yükseköğretim
Programları ve Kontenjanları Kılavuzu" veya ilgili yıl duyurusu) yayınladığı
taban puan hesaplama katsayı tablosunu bulup elle girmek.

Bu klasördeki `template.csv`'yi doldurup `load.mjs`'i çalıştırınca veri
`score_coefficients` tablosuna yazılır — **hiçbir noktada yokatlas.yok.gov.tr
veya başka bir siteye istek atılmaz**, yalnız Supabase'e yazılır.

## 1) template.csv'yi doldur

15 satır var (2023/2024/2025 × TYT/SAY/EA/SÖZ/DİL). Her satırda yalnız o
puan türüne ait dersleri doldur, kalanları BOŞ bırak (loader boş hücreleri
atlar):

| score_type | doldurulacak kolonlar |
|---|---|
| TYT | base_score, tyt_turkce, tyt_sosyal, tyt_matematik, tyt_fen |
| SAY | ^ + ayt_matematik, ayt_fizik, ayt_kimya, ayt_biyoloji |
| EA | ^ + ayt_matematik, ayt_edebiyat, ayt_tarih1, ayt_cografya1 |
| SÖZ (`SOZ`) | ^ + ayt_edebiyat, ayt_tarih1, ayt_cografya1, ayt_tarih2, ayt_cografya2, ayt_felsefe, ayt_dkab |
| DİL (`DIL`) | ^ + ydt |

`base_score` her satırda dolu olmalı (ÖSYM'nin o puan türü/yıl için sabit
başlangıç değeri).

## 2) Yükle

```
cd tools/score-coefficients
node load.mjs
```

`../yokatlas-scraper/.env`'deki `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`'i
kullanır (aynı proje, ayrı bir .env'e gerek yok). Upsert yapar — `year`+
`score_type` eşleşen satırı GÜNCELLER, yenisini ekler; tekrar çalıştırmak
güvenlidir.
