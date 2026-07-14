# Atlas — Backend Geliştirme Dokümanı

> Bu doküman backend'i geliştirecek kişi (ve onun Claude oturumu) için yazıldı.
> Kendi başına yeterlidir: ürünü, mevcut durumu, veri modelini, iş kurallarını,
> Edge Function spec'lerini ve yol haritasını içerir.
> Tasarım kararlarının ana kaynağı: `atlas_fable_brief.md` (Göktuğ'da, Downloads'ta).
> Çelişki olursa bu doküman + `supabase/schema.sql` esas alınır.

---

## 1. Ürün Özeti

**Atlas** — YKS'ye (Türk üniversite sınavı) hazırlanan 16–19 yaş öğrenciler için
mobil uygulama. Konsept: **Duolingo mekanikleri** (streak, XP, can, konu ağacı)
+ **Clash of Clans kale fethi** teması. Kullanıcı her ders için bir "kale"
fetheder; konular quiz'lerle geçilir, tüm dersler bitince "TYT Ana Kalesi" düşer.

**Stack (brief §11):**

| Katman | Teknoloji |
|---|---|
| Mobil | React Native + Expo SDK 57 (`atlas-mobile/`) |
| Backend | Supabase — PostgreSQL + Auth + Edge Functions |
| Build | EAS Build (Mac'siz iOS derleme) |
| AI Koç | DeepSeek `deepseek-chat` (OpenAI uyumlu API) — brief Gemini diyordu, karar değişti |
| Push | Expo Push Notifications |

**Monetizasyon:** Sadece **Tarih dersi ücretsiz**. Premium = diğer tüm dersler
+ AI koç + haftalık sınav + sınırsız can. Fiyat hedefi: 49–69 TL/ay veya
199–249 TL/yıl abonelik.

---

## 2. Repo Haritası

> ⚠️ Bu ağaç 2026-07-14'te canlı Supabase şemasıyla (PostgREST OpenAPI spec)
> karşılaştırılıp doğrulandı — aşağıdaki tüm `supabase/*.sql` dosyaları,
> `shared/`, `tools/` ve Edge Function'lar CANLI PROJEDE mevcut/çalışır
> durumda (bkz. §11 sonu — doğrulama yöntemi ve tam RPC/tablo listesi).

```
atlasv1.1/
├── index.html              ← Çalışan HTML prototipi (TEK KAYNAK: tüm ekranlar,
│                              akışlar, örnek soru/kart verileri burada)
├── assets/                 ← Üretilmiş görseller (maskot 3 poz + 3D kale)
├── shared/yks-calc.ts      ← YKS puan hesaplama formülü — TEK kaynak, hem
│                              atlas-mobile (Metro) hem calculate-yks-score
│                              (Deno) bunu import eder, iki kez yazılmaz
├── tools/
│   ├── embed-assets.ps1           ← Görselleri index.html'e base64 gömen script
│   ├── build-tarih-seed.mjs       ← supabase/content/tarih/*.tsv → seed_tarih_full.sql üretir
│   ├── score-coefficients/        ← Gerçek ÖSYM katsayılarını elle yükleme aracı (bkz. §11.2)
│   └── yokatlas-scraper/          ← YÖK Atlas program/taban puan scraper'ı (bkz. §11.3)
├── supabase/
│   ├── schema.sql          ← DB şeması v1 (tablolar + RLS + ders seed'leri)
│   ├── finish_quiz.sql, hearts.sql, username.sql, onboarding.sql,
│   │   profile-names.sql, exam_track.sql, legal-consent.sql, monetization.sql,
│   │   premium_expiry.sql, payments.sql  ← §4-§7'deki iş kuralları/güvenlik
│   ├── yks_programs.sql, yks_programs_search.sql, score_rank_distribution.sql,
│   │   score_coefficients.sql, tercih_robotu.sql  ← §11: tercih robotu + puan hesaplama
│   ├── seed_tarih.sql, seed_tarih_full.sql, seed_tyt_extra.sql,
│   │   ayt-subjects.sql, seed_ayt.sql  ← ders içeriği (bkz. §3 içerik durumu)
│   ├── content/tarih/*.tsv  ← seed_tarih_full.sql'in kaynağı (240 soru/222 kart ham verisi)
│   └── README.md           ← Supabase kurulum checklist'i — ⚠️ 2026-07-14 itibarıyla
│                              ✅/⬜ işaretleri GÜNCEL DEĞİL (çoğu ⬜ aslında yüklü,
│                              bkz. §11 sonu); DOSYALARIN SIRASI/İÇERİĞİ hâlâ doğru.
├── atlas-mobile/           ← Expo SDK 57 uygulaması
│   ├── src/app/            ← expo-router ekranları (index=Ev, harita, koc, yanlislar, kale/, tabs)
│   ├── src/components/     ← app-tabs, hearts/, map/, payment/, premium/, ui/
│   ├── src/constants/atlas-theme.ts     ← Tüm tasarım token'ları (renk/radius/font)
│   ├── src/lib/supabase.ts              ← Supabase istemcisi
│   └── .env                             ← EXPO_PUBLIC_SUPABASE_URL / ANON_KEY (dolduruldu)
└── BACKEND.md              ← bu dosya
```

**Prototipi incelemek için:** `index.html`'i tarayıcıda aç (görseller gömülü,
internet sadece Google Fonts için gerekir). Quiz motoru, can sistemi, haftalık
sınav, koç sohbeti, yazılı flashcard — hepsi çalışır durumda ve JS'i okunaklı.

---

## 3. Sınav Yapısı ve İçerik Hiyerarşisi

```
subject (ders/kale) → unit (bölüm) → topic (konu) → question (5 şıklı) / flashcard (yazılı)
```

**TYT dersleri (7 kale):** Türkçe, Tarih, Coğrafya, Felsefe, Fizik, Kimya, Biyoloji
*(Fen tek kale değil — kullanıcı kararıyla üçe bölündü: Fizik/Kimya/Biyoloji.)*

**AYT-EA dersleri:** Edebiyat, Tarih (AYT), Coğrafya (AYT), Felsefe (AYT)

Kullanıcı onboarding'de seçer: `tyt` veya `tyt_ayt_ea` (→ `profiles.exam_track`,
`set_exam_track()` RPC ile yazılır — bkz. `supabase/exam_track.sql`).

Örnek içerik yapısı (Tarih, prototipte mevcut):
- Bölüm 1 — Kuruluş Dönemi: Osman Bey Dönemi, Orhan Bey Dönemi, Rumeli'ye Geçiş
- Bölüm 2 — Yükselme Dönemi: Ankara Savaşı ve Fetret Devri, İstanbul'un Fethi, Kanuni ve Zirve Dönemi

**İçerik durumu — CANLI DB'de doğrulandı (2026-07-14):** 11 ders (7 TYT + 4 AYT),
12 ünite, 40 konu, **194 soru, 101 flashcard**. Bu, `seed_tarih.sql` (minimal
Tarih) + `seed_tyt_extra.sql` (Coğrafya/Felsefe eki + Fizik/Kimya/Biyoloji/
Türkçe'nin sıfırdan taslağı) + `ayt-subjects.sql` + `seed_ayt.sql` (Edebiyat +
3 AYT dersi taslağı) toplamıdır — **hepsi taslak/minimal**, pedagojik kontrolden
geçmedi (bkz. §6.5). `seed_tarih_full.sql` (Tarih için 54 ünite/111 konu/240
soru/222 kart — `supabase/content/tarih/*.tsv`'den `tools/build-tarih-seed.mjs`
ile üretilir) **HENÜZ ÇALIŞTIRILMADI** — bu, mevcut en büyük içerik boşluğu.

---

## 4. İş Kuralları (Oyun Mekanikleri)

Backend'in doğru uygulaması gereken kurallar. "KESİN" = prototipte/briefte
sabitlenmiş; "ÖNERİ" = henüz kararlaştırılmadı, Göktuğ'la netleştirin.

### 4.1 Can (Hearts) — KESİN
- **Tek/global can havuzu:** maksimum 5 can (`profiles.hearts`), **7 dersin
  tamamı için ortak** — ders bazlı ayrı bir can sistemi YOK ve olmayacak.
  Herkes için geçerli (premium dahil — eski "premium'da sınırsız can" kuralı
  kaldırıldı, karar değişti).
- Quiz'de her yanlış cevap **−1 can**, ANINDA (`lose_heart()` RPC — quiz
  bitmesini beklemez, bkz. §6.1 notu). 0 canda quiz'e devam edilemez: "Canın
  Bitti" ekranına düşer VE otomatik olarak can satın alma ekranına (`/odeme`)
  yönlendirilir — kullanıcı ayrıca bir butona basmak zorunda kalmaz.
- **KESİN (2026-07-13, son karar):** Can **1 saatte 1** kendiliğinden
  yenilenir (`calc_regen_hearts()`/`get_hearts()`, bkz. `supabase/hearts.sql`).
  Bu özellik 2026-07-08'de önce eklendi, sonra "olmasın" denip tamamen
  kaldırıldı, sonra TEKRAR istenip 8 saatte 1 olarak geri getirildi, son
  olarak 2026-07-13'te hız 1 saatte 1'e çıkarıldı — kullanıcı arayüzünde
  **görünür bir geri sayımla** birlikte (kale ekranı, ana sayfa, "Canın Bitti"
  ekranı: "+1 can: Xsa Ydk"). Kullanıcı yenilenme mekanizmasını UI'dan görüp
  öğrenebilmeli — bu şart. Ayrıca can satın alarak da (iyzico) anında 5/5'e
  doldurulabilir; iki mekanizma birbirini dışlamaz.
- Ekstra can gerçek parayla satın alınır: **anlık tam doldurma** (5/5),
  tüketilebilir ürün — **iyzico** üzerinden (bkz. §7 ve `supabase/functions/iyzico-pay/`
  + `supabase/hearts.sql` — `refill_hearts()` RPC, iyzico ödemesi başarılı
  olunca Edge Function tarafından service_role ile çağrılır).

### 4.2 Seri (Streak) — KESİN
- Gün içinde en az 1 quiz bitirmek seriyi +1 artırır (`streak_count`,
  `streak_updated_on`). Gün atlanırsa sıfırlanır.
- Gün sınırı **Europe/Istanbul** saat dilimine göre hesaplanmalı.

### 4.3 XP — KESİN (prototip değerleri)
- Doğru cevap başına **9 XP** (5/5 quiz = 45 XP).
- Günlük hedef varsayılan **200 XP** (`profiles.daily_xp_goal`).
- Her kazanım `xp_events` tablosuna satır olarak yazılır (günlük toplam sorguyla).

### 4.4 Yıldız — KESİN
Quiz sonunda konuya yıldız: 5/5 → ⭐⭐⭐, 4/5 → ⭐⭐, altı → ⭐ (`topic_progress.stars`).

### 4.5 Konu kilidi — KESİN
Konular ders içinde **lineer** açılır: bir konu `done` olunca sıradaki `locked`
→ `active` olur. İlk konu her derste `active` başlar.

### 4.6 Yanlış havuzu — KESİN
- Quiz'deki her yanlış cevap `mistakes` tablosuna girer (`unique(user_id, question_id)` —
  aynı soru ikinci kez yanlışlanırsa mevcut satır güncellenir, `resolved_at` sıfırlanır).
- Kullanıcı yanlışı tek soruluk quiz'le doğru çözerse `resolved_at` dolar.

### 4.7 Haftalık Mini Sınav — KESİN (kullanıcı kararı)
- **Her Pazar** push bildirimi gider; o haftanın **çözülmemiş yanlışlarından 5 soru**
  ile sınav kurulur (`weekly_exams`).
- Uygulamada ayrıca "Tüm Bekleyenleri Çöz" gibi bir toplu buton YOK — haftalık
  sınav bu işi üstlenir (kullanıcı bunu özellikle istedi).
- 5'ten az yanlış varsa: eldeki kadarıyla kur; hiç yoksa bildirim "Bu hafta hiç
  yanlışın yok 🎉" tebriğine dönüşür (sınav satırı açılmaz).

### 4.8 Flashcard (yazılı cevap) — KESİN
- Kart önünde soru, kullanıcı cevabı **yazar**, uygulama doğru/yanlış der.
- Eşleştirme algoritması (prototip `normTr` + `checkCard`, aynen taşınmalı):
  1. Normalize: `toLocaleLowerCase('tr')`, yalnız `a-zçğıöşü0-9 .` kalır, boşluklar tekil.
  2. Kabul: girdi === kabul edilen ‖ girdi kabul edileni içeriyor ‖
     (girdi ≥3 karakter VE kabul edilen girdiyi içeriyor VE girdi uzunluğu ≥ kabul edilenin %60'ı).
  3. `flashcards.accepted_answers text[]` içindeki HERHANGİ biriyle eşleşme yeter.
- Flashcard'lar konu ağacında yaşar: yalnız `done` konularda açılır (tekrar aracı).

### 4.9 Premium erişim — KESİN
- `subjects.is_free = true` olan tek ders Tarih.
- Ücretsiz kullanıcı: Tarih içeriği + temel özellikler. Koç, haftalık sınav,
  diğer dersler → premium. (Can artık premium'un bir parçası DEĞİL — §4.1'e bak,
  herkes aynı 5 can tavanına tabi, ekstra can ayrı parayla satın alınıyor.)
- **KARAR DEĞİŞTİ — Abonelik doğrulaması iyzico** (RevenueCat'ten vazgeçildi;
  Apple/Google mağaza hesapları kurulmadan, tüm platformlarda tek ödeme
  sağlayıcısıyla ilerlemek için). `supabase/functions/iyzico-pay/` başarılı
  ödeme sonrası `profiles.is_premium` + `premium_expires_at`'ı günceller;
  süresi dolan abonelikler `expire-premium` Edge Function'ıyla (günlük cron)
  kapatılır. ⚠️ Apple App Store, dijital abonelik için mağaza-dışı ödemeyi
  kural ihlali sayabilir — bu risk v1'de bilerek kabul edildi (Göktuğ kararı).

---

## 5. Veri Modeli

Şema hazır: **`supabase/schema.sql`** — Supabase SQL Editor'de çalıştırılır.
RLS açık: kullanıcı tabloları "sadece sahibi", içerik tabloları "authenticated
okur / sadece service_role yazar". Ders seed'leri dahil.

| Tablo | Ne tutar | Kritik alanlar |
|---|---|---|
| `profiles` | auth.users 1:1 profil | exam_track, hearts, hearts_updated_at, streak_count, streak_updated_on, is_premium, premium_expires_at, ads_removed, expo_push_token, username, first_name, last_name, onboarding_completed, terms_accepted_at, target_university, target_department |
| `subjects` | dersler/kaleler (seed'li) | id ('tarih'...), color, exam_type (tyt/ayt), is_free, sort_order — **11 satır canlı**: 7 TYT + 4 AYT |
| `units` | bölümler | subject_id, sort_order |
| `topics` | konular | unit_id, sort_order |
| `questions` | 5 şıklı sorular | options jsonb (5 eleman), correct_index 0-4, explanation |
| `flashcards` | yazılı kartlar | answer (gösterim), accepted_answers text[] (eşleşme) |
| `topic_progress` | kullanıcı konu durumu | status locked/active/done, stars 0-3 |
| `quiz_attempts` | quiz oturumları | mode: topic/weekly/single/flashcards |
| `mistakes` | yanlış havuzu | unique(user,question), resolved_at null = bekliyor |
| `xp_events` | XP defteri | amount, reason, created_at |
| `coach_messages` | koç sohbet geçmişi | role: user/coach |
| `mock_exams` | deneme sonuçları | nets jsonb: {"turkce":32.5,...} |
| `weekly_exams` | Pazar sınavları | unique(user,week_start), question_ids uuid[], notified_at |
| `payments` | iyzico ödeme denemeleri (audit) | product, amount, status, iyzico_payment_id, raw_response — bkz. §7, `payments.sql` |
| `user_exam_results` | kullanıcının hesapladığı YKS puanları | year, score_type, net_detail, ham_puan, obp, yerlestirme_puani — bkz. §11.1 |
| `score_coefficients` | ÖSYM puan katsayıları | year, score_type, base_score, coefficients jsonb — gerçek değerler yüklü (2026-07-14, bkz. §11.2) |
| `yks_programs` | YÖK Atlas lisans programları (scrape) | birim_id (doğal anahtar), university, department, score_type, city — **12.063 satır canlı** |
| `yks_program_stats` | program×yıl istatistiği (scrape) | program_id, year, min_score, min_rank, quota, net_detail — **32.225 satır canlı, 2023-2025** |
| `score_rank_distribution` | VIEW (kopya değil) | yks_program_stats/yks_programs'tan türer, puan↔sıra ampirik dağılımı — bkz. §11.1 rank-estimator notu |

Yeni auth kullanıcısında `handle_new_user()` trigger'ı profil satırını açar.

---

## 6. Backend İşleri — TAMAMLANDI (canlı DB'de doğrulandı 2026-07-14)

> Bu bölüm başlangıçta bir "yapılacaklar" listesiydi. §6.1-§6.6'daki HEPSİ
> artık canlı Supabase projesinde mevcut ve doğrulandı (PostgREST şeması
> üzerinden: tüm RPC'ler — `finish_quiz`, `get_hearts`, `lose_heart`,
> `refill_hearts` — ve tüm Edge Function'lar çalışır durumda). Gerçek açık
> işler için §6.7'ye bak. Aşağıdaki alt başlıklar artık spesifikasyon/referans
> olarak okunmalı, "yapılacak" olarak değil.

### 6.1 `finish_quiz` RPC (Postgres function) — İLK İŞ
Quiz bitişi atomik olmalı; istemciden 6 ayrı yazma yaptırma. Spec:

```
finish_quiz(
  p_topic_id uuid,          -- weekly/single modda null olabilir
  p_mode text,              -- 'topic' | 'weekly' | 'single' | 'flashcards'
  p_answers jsonb           -- [{question_id, selected_index, correct}] listesi
) returns jsonb             -- {xp_earned, stars, hearts_left, streak_count}
```
Adımlar (tek transaction):
1. `quiz_attempts` satırı yaz (correct/wrong sayıları, finished_at).
2. Yanlışlar → `mistakes` upsert; doğru çözülen single-mode sorusu → `resolved_at = now()`.
3. Can — burada DÜŞÜRÜLMEZ (her yanlışta anında `lose_heart()` ile zaten
   düşmüş olur, bkz. §4.1, `supabase/hearts.sql`); yalnız güncel değeri okuyup
   `hearts_left` olarak rapor eder.
4. XP: doğru × 9 → `xp_events`.
5. `p_mode='topic'` ise: `topic_progress` → done + stars; ders içi sıradaki konuyu `active` yap.
6. Streak: `streak_updated_on` bugün (Europe/Istanbul) değilse güncelle.
7. `security definer` + `auth.uid()` ile kullanıcıyı al; asla parametreden user_id alma.

### 6.2 Edge Function: `weekly-exam` (cron, her Pazar)
- Zamanlama: Dashboard → Edge Functions → Schedules → `0 9 * * 0` (09:00 UTC = 12:00 TR).
- Algoritma:
  1. `expo_push_token`u dolu tüm (premium) kullanıcıları çek.
  2. Kullanıcı başına: son 7 günün `resolved_at is null` yanlışlarından en fazla 5 soru seç
     (ders çeşitliliği için subject bazında dağıt).
  3. `weekly_exams` upsert (`unique(user_id, week_start)` → idempotent; cron iki kez
     koşarsa ikinci koşu no-op).
  4. Expo Push API'ye POST:
     ```
     POST https://exp.host/--/api/v2/push/send
     [{ "to": "<expo_push_token>",
        "title": "🏆 Haftalık Mini Sınav hazır!",
        "body": "Bu haftaki N yanlışından sınavın seni bekliyor.",
        "data": { "route": "/yanlislar/haftalik" } }]
     ```
  5. `notified_at = now()`.
- Bildirim metnini kişiselleştirmek istenirse `deepseek-chat` ile üret (opsiyonel v2).

### 6.3 Edge Function: `coach-chat`
DeepSeek anahtarı istemciye ASLA konmaz; bu function proxy'dir.
- Input: `{ message: string }` (JWT'den kullanıcı belli).
- Akış:
  1. Kullanıcı bağlamını topla ("Koç Biliyor" çipleri — prototipteki gibi):
     zayıf ders (son 30 gün en çok yanlış), streak, haftalık hedef ilerlemesi,
     hedef bölüm (`target_university/department`), sınava kalan gün (`exam_date`),
     son deneme netleri (`mock_exams` son satır).
  2. Sistem prompt'u: motive edici, samimi, Türkçe konuşan YKS koçu; kale/fetih
     metaforunu kullanır; kısa (≤120 kelime) cevap verir; veriye dayalı öneri yapar.
  3. Son ~10 mesajı `coach_messages`ten geçmiş olarak ekle → **DeepSeek** (`deepseek-chat`, OpenAI uyumlu `/chat/completions`) çağır.
  4. Kullanıcı mesajını ve cevabı `coach_messages`e yaz, cevabı döndür.
- Rate limit ÖNERİSİ: kullanıcı başına 30 mesaj/gün (basit sayaç sorgusu).
- Deneme girişi ayrı uç değil: istemci `mock_exams`e yazar, sonra coach-chat'e
  "deneme sonucumu girdim" mesajı atar; bağlam toplama son denemeyi zaten görür.

### 6.4 Push token kaydı
İstemci `expo-notifications` ile token alır → `profiles.expo_push_token`a yazar
(RLS "own profile" bunu zaten mümkün kılar; ayrı endpoint gerekmez).

### 6.5 İçerik seed'i
`questions` + `flashcards` + `units` + `topics` için Tarih dersinin başlangıç
içeriği **prototipte hazır**: `index.html` içinde `TOPIC_QS` (5 soru),
`WEEKLY_QS` (5 karma soru), `CARDS_BY_TOPIC` (4 konu × 3 kart), `MISTAKES`
(4 örnek). Bunları SQL insert'e çevir (küçük script yeterli). Sonrası içerik
ekibi/editör işi.
tmen
**2026-07-10 güncelleme — kalan derslere TASLAK içerik eklendi:**
- `supabase/seed_tyt_extra.sql` — Coğrafya/Felsefe'nin minimal seed'ine ek
  konular + tüm TYT dersleri için flashcard; Fizik/Kimya/Biyoloji/Türkçe
  sıfırdan (her biri 1 ünite/3 konu/5 soru+flashcard).
- `supabase/ayt-subjects.sql` — `tarih_ayt`/`cografya_ayt`/`felsefe_ayt`
  ders kayıtları (AYT v1'e girdi, §9 madde 4).
- `supabase/seed_ayt.sql` — Edebiyat + 3 yeni AYT dersi için taslak içerik
  (`ayt-subjects.sql`'den SONRA çalıştırılmalı).

⚠️ Bu içerik **taslaktır**, pedagojik/alan uzmanı doğruluk kontrolünden
geçmedi — yalnızca uygulamayı oynanabilir hale getirmek için yazıldı. Yayına
almadan önce bir öğretmen/içerik uzmanının gözden geçirmesi ŞART. Yine de
her sorunun `correct_index`'i seçeneklerle karşılaştırılarak doğrulandı ve
yalnız kesin/tartışmasız temel müfredat bilgisi kullanıldı.

### 6.6 Can yenileme — TAMAMLANDI (son karar)
"1 saatte 1 can" (§4.1) uygulandı: `supabase/hearts.sql` içinde
`calc_regen_hearts()` (saf hesap) + `get_hearts()` (RPC, kalıcı yazar +
`next_heart_at` döner). İstemci kale/ana sayfa/"Canın Bitti" ekranlarını
açarken `get_hearts()` çağırır ve geri sayımı gösterir (`components/hearts/
hearts-empty-card.tsx`'teki `formatCountdown`). `lose_heart()` de (anlık can
düşürme) önce bekleyen regen'i uygulayıp SONRA düşürür, geri sayımı düşüş
anından yeniden başlatır. NOT: bu özellik bir kez eklenip kaldırılıp tekrar
eklendi (aynı gün) — geri sayım UI'ı olmadan sadece sessiz regen istenmedi,
şart olan kısım kullanıcının bunu GÖREBİLMESİ.

### 6.7 Gerçek açık işler (2026-07-14 itibarıyla)

Kod/DB tarafında eksik olan, "yapılacaklar listesi"nin gerçek kalıntısı:

1. **`seed_tarih_full.sql` çalıştırılmadı** — Tarih dersi hâlâ minimal taslak
   içerikte (bkz. §3). Çalıştırılırsa Tarih'in mevcut konu/soru/kart'larını
   SİLİP 54 ünite/111 konu/240 soru/222 kart ile YENİDEN yükler — kullanıcı
   ilerlemesi (`topic_progress`, `mistakes`) eski `topic_id`'lere bağlıysa
   etkilenebilir mi kontrol edilmeden ÇALIŞTIRILMAMALI (henüz gerçek kullanıcı
   yoksa risksiz).
2. ~~`score_coefficients` hâlâ placeholder~~ → **ÇÖZÜLDÜ (2026-07-14).** Gerçek
   katsayılar `tools/score-coefficients/template.csv` üzerinden yüklendi (TYT:
   Türkçe/Matematik 3.3, Sosyal/Fen 3.4; AYT'ye TYT katkısı tüm puan türlerinde
   1.32/1.32/1.36/1.36; SAY: Mat 3.00/Fizik 2.85/Kimya 3.07/Biyoloji 3.07; EA:
   Mat 3.00/Edebiyat 3.00/Tarih-1 2.80/Coğrafya-1 3.30; SÖZ: Edebiyat 3.00/
   Tarih-1 2.80/Coğrafya-1 3.30/Tarih-2 2.90/Coğrafya-2 2.90/Felsefe 3.00/DKAB
   3.30; DİL: YDT 3.00; `base_score` hepsinde 100). 2023/2024/2025 için aynı
   (bu katsayılar 2018 YKS reformundan beri değişmedi, yıldan yıla değişen
   taban puan/sıradır, katsayı değil). **Kaynak notu:** resmi ÖSYM PDF'i
   doğrudan çekilemedi (dokuman.osym.gov.tr WAF engeli, bkz. §11.3) — bu
   değerler üç bağımsız YKS hazırlık kaynağının (kariyer.net, pegemkurs.com,
   vd.) birebir örtüştüğü, yıllardır değişmemiş, yaygın bilinen değerler.
   Kesinlik için resmi kılavuzla çapraz kontrol edilmesi hâlâ faydalı olur
   ama akış artık gerçekçi sayılarla çalışıyor. 15 satır canlı DB'de
   doğrulandı (`select year,score_type,coefficients from score_coefficients`).
3. **`payments` tablosu boş** — iyzico-pay Edge Function'ı gerçek/sandbox bir
   ödemeyle uçtan uca hiç test edilmemiş görünüyor (canlı DB'de 0 satır).
4. **Legacy `dev_set_premium`/`dev_set_ads_removed` RPC'leri** (`monetization.sql`)
   hâlâ DB'de duruyor ama istemci artık bunları çağırmıyor (iyzico-pay'e
   geçildi) — ölü kod, istenirse `drop function` ile temizlenebilir.
5. **`supabase/README.md`'deki ✅/⬜ checklist güncel değildi** — bu oturumda
   canlı şema doğrulanıp düzeltildi (bkz. dosyanın kendisi); ileride yeni bir
   SQL dosyası yazılınca bu checklist'i güncellemeyi unutma, aksi halde tekrar
   yanıltıcı hale gelir.
6. **Koç günlük proaktif bildirimleri** (§9 madde 5) — hâlâ açık, v2'ye bırakıldı.
7. ~~`supabase/tercih_aralik.sql` henüz çalıştırılmadı~~ → **ÇÖZÜLDÜ (2026-07-14).**
   `tercih_sira_araligi` RPC canlı DB'de doğrulandı (gerçek sıra aralığı
   sorgusu, doğru sıralı 100 sonuç döndü).

---

## 7. Güvenlik Kuralları

- **service_role** anahtarı yalnız Edge Functions env'inde. İstemciye sadece `anon` key.
- Tüm kullanıcı yazmaları RLS'den geçer; `finish_quiz` gibi RPC'ler
  `security definer` + `auth.uid()` kullanır — user_id parametre olarak alınmaz.
- İçerik tabloları istemciden yazılamaz (seed dashboard/service_role ile).
- DeepSeek API anahtarı yalnız `coach-chat` function env'inde.
- iyzico API key/secret yalnız `iyzico-pay` function env'inde — istemci kart
  bilgisini bu function'a gönderir, fiyat/imza/onay tamamen sunucu tarafında.
- Premium kontrolü istemciye bırakılmaz: koç, haftalık sınav ve premium ders
  içeriği server tarafında da `is_premium` / `subjects.is_free` ile doğrulanır.
  (İçerik gating v1'de: premium olmayan kullanıcıya `is_free=false` derslerin
  question/flashcard satırlarını RLS ile kapatmak istenirse policy'ye
  `exists(select 1 from profiles p where p.id=auth.uid() and (p.is_premium or ...))`
  eklenebilir — v1'de istemci gating'i + RPC kontrolü yeterli, v2'de sıkılaştır.)
- **Kolon bazlı yazma kilidi** (`monetization.sql`, sonra `profile-names.sql`/
  `legal-consent.sql` ile genişletildi): `profiles` RLS'i yalnız SATIR
  sahipliğini kontrol eder; `authenticated`'in doğrudan UPDATE edebileceği
  kolonlar GRANT ile daraltıldı (username, first/last_name, target_*,
  exam_date, daily_xp_goal, expo_push_token, onboarding_completed,
  terms_accepted_at). `hearts`, `is_premium`, `premium_expires_at`,
  `ads_removed`, `streak_*`, `exam_track` gibi hassas alanlar YALNIZ
  SECURITY DEFINER RPC'ler (`finish_quiz`, `refill_hearts`, `set_exam_track`,
  iyzico-pay/expire-premium'un service_role yazması) üzerinden değişir.
- **`delete-account`** Edge Function: `auth.admin.deleteUser()` ile hesabı
  siler; tüm kullanıcı tabloları `on delete cascade` olduğundan tek çağrı
  yeterli (App Store 5.1.1(v) + KVKK "unutulma hakkı").
- **`is_username_available`** RPC'si `security definer` ile yalnız
  boolean döner — `profiles` RLS'i "sadece sahibi" olduğu için client başka
  satırları SELECT edemez, canlı kullanılabilirlik kontrolü bu yüzden ayrı
  bir RPC'ye ihtiyaç duyar.
- **`payments`** tablosu yalnız `iyzico-pay` (service_role) yazar; kullanıcı
  yalnız kendi satırlarını okuyabilir (audit/destek amaçlı, bkz. §11 dışı —
  ana akış §7 başında).

## 8. Konvansiyonlar

- **Zaman dilimi:** iş kuralları Europe/Istanbul'a göre (streak, "bugün", hafta başı pazartesi).
- **Dil:** UI metinleri Türkçe; kod/kolon adları İngilizce-Türkçe karışık kısa slug
  (ders id'leri: 'tarih', 'turkce'... — schema.sql'deki seed'e uy).
- **ID'ler:** içerik ve kullanıcı verisi uuid; `subjects.id` okunabilir text slug.
- **İstemci env:** yalnız `EXPO_PUBLIC_` önekli değişkenler (bkz. `.env.example`).

## 9. Açık Kararlar (Göktuğ'la netleştirilecek)

1. ~~Can zamanla yenilensin mi?~~ → **EVET, 1 saatte 1 + görünür geri sayım — karar kesin** (§4.1, §6.6; hız 2026-07-13'te 8 saatte 1'den 1 saatte 1'e çıkarıldı). "Reklam izle can kazan" maddesi 7 numaralı karara bağlı olarak KAPANDI — v1'de reklam altyapısı yok, bu yüzden reklamla can kazanma da yok.
2. ~~Abonelik altyapısı: RevenueCat mi, StoreKit2/Play Billing doğrudan mı?~~ → **iyzico'ya karar verildi** (§4.9, §7).
3. ~~Streak dondurma (Duolingo "streak freeze") olacak mı?~~ → **HAYIR, v1'de yok** (2026-07-10 karar). Basit tutuluyor: gün atlanırsa seri sıfırlanır. v2'de tekrar değerlendirilebilir.
4. ~~AYT içeriğinin v1'e girip girmeyeceği~~ → **EVET, v1'de var** (2026-07-10 karar). `subjects` tablosuna `tarih_ayt`/`cografya_ayt`/`felsefe_ayt` eklendi (bkz. `supabase/ayt-subjects.sql`, `edebiyat` zaten vardı); harita ekranına TYT/AYT geçiş sekmesi eklendi (yalnız `exam_track='tyt_ayt_ea'` kullanıcılarında görünür, bkz. `components/map/map-screen.tsx`). Taslak içerik: `supabase/seed_ayt.sql`.
5. Koç günlük proaktif bildirimleri (Flash Lite) v1'de mi v2'de mi? → Henüz açık; push altyapısı (token kaydı) v1'de kuruldu ama proaktif/zamanlı bildirim mantığı yazılmadı — varsayılan olarak v2'ye bırakılıyor, aksini söylersen v1'e alınır.
6. ~~KVKK/veli onayı akışı~~ → **v1'de var** (2026-07-10). Onboarding'de zorunlu onay checkbox'ı + `hukuki.tsx` (Gizlilik Politikası/Kullanım Şartları, taslak metin — hukuki incelemeden GEÇMEDİ, yayından önce avukata/danışmana onaylatılmalı) + `profiles.terms_accepted_at` (bkz. `supabase/legal-consent.sql`).
7. ~~"Reklamsız" özelliği v1'de kalsın mı?~~ → **HAYIR, v1'den çıkarıldı** (2026-07-10 karar). Gerekçe: hiçbir reklam SDK'sı kurulu değildi, olmayan bir şey satılıyordu; gerçek AdMob entegrasyonu Expo Go'yu tamamen terk edip dev client/EAS build + bir AdMob hesabı gerektiriyor. `reklamsiz.tsx` silindi, `ayarlar.tsx`'teki satın alma girişi kaldırıldı. Backend tarafında `ads_removed` alanı/ürünü (iyzico-pay, payments.sql) DOKUNULMADAN bırakıldı — ileride gerçek reklam eklenirse UI'ı geri takmak yeterli olur.
8. **Tercih Robotu risk bant eşikleri** (`tercih_oner`, §11.1) — rank oranı
   0.90/1.10/1.35, puan farkı +2/-2/-8 — bir ÜRÜN kararı olarak `tercih_robotu.sql`
   içine gömüldü ama Göktuğ'la ayrıca teyit edilmedi. Değiştirmek istenirse
   tek yer bu dosyadaki CASE ifadeleri.

## 10. Hızlı Başlangıç (backend geliştirici)

```bash
# 1. Supabase projesi aç (eu-central-1) → SQL Editor'de SIRAYLA çalıştır:
#    schema.sql → finish_quiz.sql → seed_tarih.sql → username.sql → onboarding.sql
#    → hearts.sql → monetization.sql → yks_programs.sql → yks_programs_search.sql
#    → score_rank_distribution.sql → score_coefficients.sql → tercih_robotu.sql
#    → profile-names.sql → exam_track.sql → legal-consent.sql → premium_expiry.sql
#    → payments.sql → seed_tyt_extra.sql → ayt-subjects.sql → seed_ayt.sql
#    (2026-07-14 itibarıyla hepsi canlı projede zaten uygulanmış durumda —
#    bu sıra yalnız SIFIRDAN bir Supabase projesi kurulumu için geçerli.)
# 2. Anahtarları al: Settings > API → atlas-mobile/.env dosyasına koy
# 3. Mobil iskeleti çalıştır (Node 20+):
cd atlas-mobile
npm install        # zaten kurulu ama emin ol
npx expo start     # Expo Go ile test
# 4. Edge Functions için:
npx supabase init && npx supabase functions new weekly-exam
```

Tüm §6 işleri + §11'deki tercih robotu/puan hesaplama/YÖK Atlas verisi
tamamlanmış durumda (bkz. §6 başlığı). Gerçek açık işler için §6.7'ye bak
(en önemlisi: `seed_tarih_full.sql` çalıştırılmadı, `score_coefficients`
placeholder).

---

## 11. Tercih Robotu, Puan Hesaplama ve YÖK Atlas Verisi

> BACKEND.md'nin ilk sürümünde hiç yer almayan, sonradan eklenen ayrı bir alt
> sistem — YKS puan hesaplama + üniversite/bölüm tercih önerisi. §1-§10'daki
> "Duolingo mekanikleri" akışından bağımsız çalışır, ortak nokta yalnız
> `profiles`/auth.

### 11.1 Tercih Robotu

**2026-07-14 revizyonu — aktif model: sıralama ARALIĞI + risk (`tercih_sira_araligi` RPC).**
Kullanıcı isteğiyle giriş mekanizması değişti: tek sıra/puan yerine kullanıcı
**en düşük** ve **en yüksek** sıralamasını girer (`p_rank_min`/`p_rank_max`);
`tercih_sira_araligi()` (bkz. `supabase/tercih_aralik.sql`) bu aralıktaki
taban sıraya sahip TÜM programları (puan türü/şehir/üniversite türü/program-
üniversite filtreleriyle) döndürür, en iyi (en düşük) taban sıra önce.
**Puan girişi kaldırıldı** ama diğer her şey (Puan Türü, Yıl, Risk,
Üniversite Türü filtreleri + risk rozetleri) KORUNDU — ilk revizyonda
(bir önceki commit) bunlar da yanlışlıkla kaldırılmıştı, kullanıcı geri
istedi. Fark: **risk artık RPC'den gelmiyor, `tercih.tsx` içinde istemcide
hesaplanıyor** (`riskFromPosition()`) — her sonucun taban sırası, kullanıcının
KENDİ girdiği [rankMin, rankMax] aralığının neresine düşüyorsa ona göre: alt
üçte bir → 🟢güvenli, orta → 🟡dengeli, üst üçte bir → 🔴riskli. Bu, eski
`tercih_oner`'ın sabit oran eşikli (0.90/1.10/1.35) formülünden farklı bir
mantık — kullanıcının kendi belirsizlik aralığına göreceli.
`tercih.tsx` artık bu RPC'yi kullanıyor (`fetchTercihSiraAraligi`, bkz.
FRONTEND.md §7). Yıl seçici geri kondu (2025/2024/2023) ama veri kısıtı
yüzünden yalnız 2025 sonuç verir (aşağıya bak).

**Veri kısıtı (değişmedi):** `min_rank` (taban başarı sırası) YÖK Atlas'ta
yalnız **2025** (güncel yıl) için var; 2023/2024'te yalnız `min_score`. Başka
yıl seçilirse ekranda uyarı gösterilir, sonuç muhtemelen boş döner.

**Eski model — `tercih_oner` RPC (artık istemciden çağrılmıyor, ama DB'de
hâlâ duruyor, silinmedi):** Kullanıcı YKS sırasını (`p_rank`) ya da puanını
(`p_score`) girer + filtreler; `tercih_oner()` (bkz. `supabase/tercih_robotu.sql`)
her programın o yılki taban sıra/puanıyla kıyaslayıp sabit oranlı 3 risk
sınıfına ayırır:

| Risk | Sıra ile (kullanıcı/taban oranı) | Puan ile (kullanıcı-taban farkı) |
|---|---|---|
| 🟢 güvenli | rank ≤ taban × 0.90 | puan − taban ≥ +2 |
| 🟡 dengeli | rank ≤ taban × 1.10 | puan − taban ≥ −2 |
| 🔴 riskli | rank ≤ taban × 1.35 | puan − taban ≥ −8 |

Eşikler bir ürün kararıdır (§9 madde 8) — model artık kullanılmadığı için bu
karar da fiilen geçersiz, ama fonksiyon silinmediği için not bırakıldı.

**`score_rank_distribution`** VIEW'ı (`yks_program_stats`/`yks_programs`'tan
türer, ayrı tablo değil — otomatik senkron) ~32 bin gerçek (puan, sıra)
noktası sunar; ÖSYM artık resmi bir "Puanların ve Sıralamaların Dağılımı"
tablosu yayınlamıyor, bu yüzden kendi verimiz bunun yerine geçiyor
(bkz. `tools/yokatlas-scraper/README.md`, ampirik ve daha granüler).
`shared/rank-estimator.ts` (`tahminSira()`) bu nokta bulutu üzerinde lineer
interpolasyon yapıyor — **yazıldı ve kullanılıyor** (`atlas-mobile/(tabs)/puan.tsx`).
Veri kısıtı `min_rank`in yalnız güncel yılda olması yüzünden pratikte tek
yıllık veriyle çalışıyor; sonuç KESİN değil, yaklaşık — UI'da mutlaka
"~yaklaşık" ibaresi + "kesin sıra için ÖSYM sonuç belgeni kontrol et" uyarısı
gösterilmeli (kodda zaten böyle not düşülmüş, ekranı FRONTEND.md'de doğrula).

### 11.2 YKS Puan Hesaplama (`calculate-yks-score` Edge Function)

Formül **tek kaynak**: `shared/yks-calc.ts` — hem `atlas-mobile` (Metro,
`metro.config.js` watchFolders ile) hem `calculate-yks-score` (Deno, relative
import) aynı dosyayı kullanır, formül iki kez yazılmaz.

```
ham_puan        = min(500, base_score + Σ(ders_neti × ders_katsayısı))
obp             = diploma_notu × 5                          (250-500 arası)
obp_katkısı     = obp × (önceki_yıl_yerleşti ? 0.06 : 0.12)  (ÖSYM kuralı)
yerleştirme_puanı = min(560, ham_puan + obp_katkısı)
```

Katsayılar `score_coefficients` tablosundan okunur (koda gömülü DEĞİL).
**Gerçek katsayılar yüklendi (2026-07-14)** — TYT: Türkçe/Matematik 3.3,
Sosyal/Fen 3.4; AYT'ye TYT katkısı (SAY/EA/SÖZ/DİL'de ortak) Türkçe/Matematik
1.32, Sosyal/Fen 1.36; SAY: Matematik 3.00, Fizik 2.85, Kimya 3.07, Biyoloji
3.07; EA: Matematik 3.00, Edebiyat 3.00, Tarih-1 2.80, Coğrafya-1 3.30; SÖZ:
Edebiyat 3.00, Tarih-1 2.80, Coğrafya-1 3.30, Tarih-2 2.90, Coğrafya-2 2.90,
Felsefe 3.00, DKAB 3.30; DİL: YDT 3.00; `base_score` hepsinde 100 —
2023/2024/2025 aynı (2018 YKS reformundan beri değişmedi). Kaynak: resmi ÖSYM
PDF'i doğrudan çekilemedi (WAF engeli), üç bağımsız YKS hazırlık kaynağının
birebir örtüştüğü yaygın bilinen değerler kullanıldı — kesinlik için resmi
kılavuzla çapraz kontrol faydalı olur ama akış artık gerçekçi çalışıyor.
Güncellemek gerekirse: `tools/score-coefficients/template.csv`'yi düzenle →
`node tools/score-coefficients/load.mjs` (upsert, tekrar çalıştırmak güvenli).

Sonuçlar `user_exam_results`e yazılır (kullanıcının kendi geçmişi, koç
bağlamı §6.3'te bunu okuyabilir).

### 11.3 YÖK Atlas Veri Hattı (`tools/yokatlas-scraper/`)

Resmi bir ÖSYM/YÖK Atlas API'si yok — `yokatlas.yok.gov.tr`'nin React SPA
bundle'ından reverse-engineer edilen gerçek endpoint'ler kullanılıyor
(auth/rate-limit yok, istekler arası 500-600ms bekletiliyor). Detaylı bulgular:
`tools/yokatlas-scraper/README.md`. Özet:

- **`collect-ids.ts`** → `/tercih-kilavuz/search` (yalnız GÜNCEL yıl: kontenjan/
  yerleşen/taban sıra) — çalıştırıldı: 12.265 program satırı.
- **`scrape-details.ts`** → `/netler/search` (ÇOK YILLI: taban puan + ders
  netleri, 2023-2025) — çalıştırıldı: 34.590 net satırı.
- **`upload.ts`** → iki checkpoint'i `kilavuzKodu`+`yıl` ile birleştirip
  `yks_programs`(`birim_id` doğal anahtar)/`yks_program_stats` tablolarına
  500'lük batch'lerle yükler — **çalıştırıldı, canlı DB'de 12.063 program +
  32.225 istatistik satırı doğrulandı** (2026-07-14).
- Doğal anahtar `birim_id` (YÖK Atlas'ın stabil program kimliği) — `kilavuzKodu`
  TEK BAŞINA yeterli değil (aynı görünen program adı altında farklı `birimId`'li
  ayrı kontenjanlar bulunabiliyor, örn. İstanbul Medipol Tıp örneği).
- Scraper checkpoint dosyaları (`program_ids.json`, `net_details.json`, 24-63MB)
  `.gitignore`'da, repoya girmez — yeniden çalıştırmak gerekirse sıfırdan
  toplar (birkaç dakika sürer, performans riski yok).
- Kapsanmayan: ÖSYM "Öğrenci Profili" istatistikleri (cinsiyet/bölge dağılımı)
  — endpoint bulunamadı, kullanıcı için zorunlu değil.

### 11.4 Doğrulama Yöntemi (bu bölümün nasıl teyit edildiği)

2026-07-14'te bu doküman güncellenirken canlı Supabase projesine service_role
anahtarıyla `GET {SUPABASE_URL}/rest/v1/` (PostgREST'in kendi OpenAPI spec'i)
çekilerek TÜM tablo/kolon/RPC listesi doğrudan doğrulandı — `supabase/README.md`
checklist'ine değil, bu canlı şemaya güvenildi. İçerik satır sayıları
(`subjects`/`units`/`topics`/`questions`/`flashcards`/`yks_programs`/
`yks_program_stats`) `Prefer: count=exact` HEAD istekleriyle sayıldı. Bu,
salt-okunur bir doğrulamaydı — hiçbir tabloya yazılmadı/değiştirilmedi.
