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

```
atlasv1.0/
├── index.html              ← Çalışan HTML prototipi (TEK KAYNAK: tüm ekranlar,
│                              akışlar, örnek soru/kart verileri burada)
├── assets/                 ← Üretilmiş görseller (maskot 3 poz + 3D kale)
├── tools/embed-assets.ps1  ← Görselleri index.html'e base64 gömen script
├── supabase/
│   ├── schema.sql          ← DB şeması v1 (tablolar + RLS + ders seed'leri) — HAZIR
│   └── README.md           ← Supabase kurulum adımları
├── atlas-mobile/           ← Expo SDK 57 iskeleti — HAZIR (npm install edilmiş)
│   ├── src/app/            ← expo-router ekranları (index=Ev, harita, koc, yanlislar)
│   ├── src/components/app-tabs.tsx      ← 4 sekmeli NativeTabs
│   ├── src/constants/atlas-theme.ts     ← Tüm tasarım token'ları (renk/radius/font)
│   ├── src/lib/supabase.ts              ← Supabase istemcisi (env bekliyor)
│   └── .env.example                     ← EXPO_PUBLIC_SUPABASE_URL / ANON_KEY
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

Kullanıcı onboarding'de seçer: `tyt` veya `tyt_ayt_ea` (→ `profiles.exam_track`).

Örnek içerik yapısı (Tarih, prototipte mevcut):
- Bölüm 1 — Kuruluş Dönemi: Osman Bey Dönemi, Orhan Bey Dönemi, Rumeli'ye Geçiş
- Bölüm 2 — Yükselme Dönemi: Ankara Savaşı ve Fetret Devri, İstanbul'un Fethi, Kanuni ve Zirve Dönemi

---

## 4. İş Kuralları (Oyun Mekanikleri)

Backend'in doğru uygulaması gereken kurallar. "KESİN" = prototipte/briefte
sabitlenmiş; "ÖNERİ" = henüz kararlaştırılmadı, Göktuğ'la netleştirin.

### 4.1 Can (Hearts) — KESİN + ÖNERİ
- Maksimum 5 can (`profiles.hearts`).
- Quiz'de her yanlış cevap **−1 can**. 0 canda quiz'e devam edilemez ("Canın Bitti" ekranı).
- Premium kullanıcıda can **sınırsız** (düşme uygulanmaz).
- ÖNERİ: Zamanla yenilenme — 30 dk'da 1 can. Sunucu saatiyle hesap:
  `hearts_updated_at` + geçen süre → istemci anlık değeri türetir, quiz
  başında/sonunda DB'ye yazılır. Ayrı cron gerekmez.

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
  diğer dersler, sınırsız can → premium.
- ÖNERİ: Abonelik doğrulaması için RevenueCat (iOS+Android tek SDK) — `profiles.is_premium`
  webhook'la güncellenir. Karar bekliyor.

---

## 5. Veri Modeli

Şema hazır: **`supabase/schema.sql`** — Supabase SQL Editor'de çalıştırılır.
RLS açık: kullanıcı tabloları "sadece sahibi", içerik tabloları "authenticated
okur / sadece service_role yazar". Ders seed'leri dahil.

| Tablo | Ne tutar | Kritik alanlar |
|---|---|---|
| `profiles` | auth.users 1:1 profil | exam_track, hearts, hearts_updated_at, streak_count, streak_updated_on, is_premium, expo_push_token |
| `subjects` | dersler/kaleler (seed'li) | id ('tarih'...), color, exam_type, is_free, sort_order |
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

Yeni auth kullanıcısında `handle_new_user()` trigger'ı profil satırını açar.

---

## 6. Yapılacak Backend İşleri (öncelik sırasıyla)

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
3. Can düş: yanlış sayısı kadar, 0 altına inme; premium ise düşme.
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

### 6.6 Can yenileme (karar sonrası)
§4.1'deki ÖNERİ onaylanırsa ekstra backend işi yok — istemci
`hearts + floor((now - hearts_updated_at)/30dk)` türetir, yazarken clamp'ler.
İstenirse `get_hearts()` RPC ile sunucuda türet.

---

## 7. Güvenlik Kuralları

- **service_role** anahtarı yalnız Edge Functions env'inde. İstemciye sadece `anon` key.
- Tüm kullanıcı yazmaları RLS'den geçer; `finish_quiz` gibi RPC'ler
  `security definer` + `auth.uid()` kullanır — user_id parametre olarak alınmaz.
- İçerik tabloları istemciden yazılamaz (seed dashboard/service_role ile).
- DeepSeek API anahtarı yalnız `coach-chat` function env'inde.
- Premium kontrolü istemciye bırakılmaz: koç, haftalık sınav ve premium ders
  içeriği server tarafında da `is_premium` / `subjects.is_free` ile doğrulanır.
  (İçerik gating v1'de: premium olmayan kullanıcıya `is_free=false` derslerin
  question/flashcard satırlarını RLS ile kapatmak istenirse policy'ye
  `exists(select 1 from profiles p where p.id=auth.uid() and (p.is_premium or ...))`
  eklenebilir — v1'de istemci gating'i + RPC kontrolü yeterli, v2'de sıkılaştır.)

## 8. Konvansiyonlar

- **Zaman dilimi:** iş kuralları Europe/Istanbul'a göre (streak, "bugün", hafta başı pazartesi).
- **Dil:** UI metinleri Türkçe; kod/kolon adları İngilizce-Türkçe karışık kısa slug
  (ders id'leri: 'tarih', 'turkce'... — schema.sql'deki seed'e uy).
- **ID'ler:** içerik ve kullanıcı verisi uuid; `subjects.id` okunabilir text slug.
- **İstemci env:** yalnız `EXPO_PUBLIC_` önekli değişkenler (bkz. `.env.example`).

## 9. Açık Kararlar (Göktuğ'la netleştirilecek)

1. Can yenileme süresi (öneri: 1 can / 30 dk) ve "reklam izle can kazan" olacak mı?
2. Abonelik altyapısı: RevenueCat mi, StoreKit2/Play Billing doğrudan mı?
3. Streak dondurma (Duolingo "streak freeze") olacak mı?
4. AYT içeriğinin v1'e girip girmeyeceği (şu an sadece harita toggle'ı var).
5. Koç günlük proaktif bildirimleri (Flash Lite) v1'de mi v2'de mi?
6. KVKK/veli onayı akışı (hedef kitle 16-19 yaş — kayıt yaşı kontrolü).

## 10. Hızlı Başlangıç (backend geliştirici)

```bash
# 1. Supabase projesi aç (eu-central-1) → SQL Editor → supabase/schema.sql çalıştır
# 2. Anahtarları al: Settings > API → atlas-mobile/.env dosyasına koy
# 3. Mobil iskeleti çalıştır (Node 20+):
cd atlas-mobile
npm install        # zaten kurulu ama emin ol
npx expo start     # Expo Go ile test
# 4. Edge Functions için:
npx supabase init && npx supabase functions new weekly-exam
```

İlk hedef: §6.1 `finish_quiz` RPC + §6.5 Tarih seed'i → mobil taraf quiz akışını
gerçek veriyle bağlayabilir. Sonra §6.2 haftalık sınav cron'u, en son §6.3 koç.
