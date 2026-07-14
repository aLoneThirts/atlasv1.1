# Atlas — Backend (Supabase) Kurulumu

## 1. Proje aç
1. [supabase.com](https://supabase.com) → New Project (bölge: `eu-central-1` Frankfurt, Türkiye'ye en yakın).
2. Veritabanı şifresini bir yere kaydet.

## 2. SQL'leri sırayla yükle ✅ (2026-07-14: canlı PostgREST şeması üzerinden doğrulandı)
Dashboard → **SQL Editor** → dosya içeriğini yapıştır → Run. **Sıra önemli:**

> ⚠️ Bu tablodaki ✅/⬜ işaretleri uzun süre güncellenmedi ve YANLIŞ hale
> gelmişti (çoğu ⬜ görünüyordu ama gerçekte yüklüydü). 2026-07-14'te
> service_role ile `GET /rest/v1/` (PostgREST OpenAPI spec) çekilip her
> RPC/tablo/kolon canlıda tek tek doğrulandı — aşağıdaki durumlar buna göre
> düzeltildi. **Yalnız `seed_tarih_full.sql` gerçekten hâlâ çalıştırılmadı**
> (bkz. BACKEND.md §6.7).

| # | Dosya | Ne yapar | Durum |
|---|---|---|---|
| 1 | `schema.sql` | 13 tablo + RLS + ders seed'leri | ✅ yüklendi |
| 2 | `finish_quiz.sql` | Atomik quiz bitirme RPC'si (BACKEND.md §6.1) | ✅ yüklendi (RPC canlıda doğrulandı) |
| 3 | `seed_tarih.sql` | Tarih 6 konu/30 soru/12 kart + Coğrafya-Felsefe test içeriği | ✅ yüklendi |
| 4 | `username.sql` | username benzersizliği + kayıt formu desteği | ✅ yüklendi (`is_username_available` RPC canlıda) |
| 5 | `onboarding.sql` | `profiles.onboarding_completed` kolonu (hedef okul/bölüm ekranı) | ✅ yüklendi |
| 6 | `hearts.sql` | `refill_hearts()` (ücretli can doldurma) + `calc_regen_hearts()`/`get_hearts()` (**1 saatte 1 can yenileme + geri sayım**) + `lose_heart()` (can artık quiz bitmeden, her yanlışta ANINDA düşer, önce regen'i uygular) | ✅ yüklendi (tüm RPC'ler canlıda doğrulandı) |
| 7 | `monetization.sql` | `ads_removed` kolonu + kolon bazlı yazma kilidi + premium/reklamsız placeholder RPC'leri | ✅ yüklendi (`dev_set_premium`/`dev_set_ads_removed` hâlâ DB'de ama istemci artık çağırmıyor — ölü kod, bkz. BACKEND.md §6.7) |
| 8 | `yks_programs.sql` | YÖK Atlas lisans program verisi (`yks_programs`+`yks_program_stats`) — scraper: `tools/yokatlas-scraper/` | ✅ yüklendi (12.063 program, 32.225 stat satırı, 2023-2025) |
| 9 | `score_rank_distribution.sql` | Puan-sıra dağılımı VIEW'ı (yks_program_stats üzerinden, ayrı scraper gerekmedi) | ✅ yüklendi |
| 10 | `score_coefficients.sql` | ÖSYM puan hesaplama şeması (`score_coefficients` + `user_exam_results`) | ✅ yüklendi — gerçek katsayılar da yüklendi (2026-07-14, `tools/score-coefficients/`, bkz. BACKEND.md §11.2) |
| 11 | `profile-names.sql` | `first_name`/`last_name` kolonları + Google girişinde de kullanıcı adı sorulması (onboarding genişletildi) | ✅ yüklendi |
| 12 | `yks_programs_search.sql` | `turkish_casefold()` + `search_yks_programs()` — okul/bölüm arama (İ/ı harf düzeltmesi) | ✅ yüklendi |
| 13 | `tercih_robotu.sql` | Tercih Robotu RPC'si (`tercih_oner`) — sıra/puan + filtre → risk sınıflı program önerileri (madde 3). **Bağımlılık:** `yks_programs.sql` + `yks_programs_search.sql` (turkish_casefold) önce çalışmış olmalı | ✅ yüklendi (`tercih_oner` RPC canlıda) |
| 14 | `seed_tarih_full.sql` | **TAM TYT Tarih içeriği** — 54 ünite / 111 konu (özetli) / 240 soru / 222 bilgi kartı. `topics.summary` kolonunu ekler. `seed_tarih.sql`'in Tarih kısmının yerine geçer (mevcut Tarih içeriğini silip yeniden yükler; Coğrafya/Felsefe'ye dokunmaz). Otomatik üretilir: `node tools/build-tarih-seed.mjs` (kaynak `supabase/content/tarih/*.tsv`). Tekrar çalıştırılabilir. | ⬜ **hâlâ çalıştırılmadı** — Tarih içeriği hâlâ minimal (bkz. BACKEND.md §3/§6.7) |
| 15 | `premium_expiry.sql` | `profiles.premium_expires_at` kolonu — iyzico ile açılan premium'un süresi (BACKEND.md §4.9) | ✅ yüklendi |
| 16 | `payments.sql` | `payments` audit tablosu — iyzico ödeme denemelerinin kaydı, yalnız kullanıcı kendi satırını okur | ✅ yüklendi (tablo var ama 0 satır — gerçek ödeme henüz test edilmedi) |

`finish_quiz.sql` tekrar çalıştırılabilir (create or replace); `seed_tarih.sql`
idempotenttir — Tarih içeriği zaten varsa hiçbir şey yazmaz. `username.sql`
de tekrar çalıştırılabilir (mevcut çakışan kullanıcı adlarını otomatik
benzersizleştirir, sonra index/trigger/RPC'yi create or replace eder).
`onboarding.sql` da tekrar çalıştırılabilir (`add column if not exists`).
`monetization.sql` da tekrar çalıştırılabilir.

**ÖNEMLİ — `monetization.sql` güvenlik için kritik:** bu dosya çalışmadan
önce herhangi bir authenticated kullanıcı kendi `profiles` satırında
`is_premium`/`hearts` gibi alanları client'tan doğrudan değiştirebilir
(RLS yalnız satır sahipliğini kontrol ediyor, kolon bazlı değil). Bu
dosya bunu GRANT ile kapatıyor — atlamayın.
`hearts.sql` da tekrar çalıştırılabilir (create or replace).

**ÖNEMLİ — `hearts.sql`'i VE `finish_quiz.sql`'i YENİDEN çalıştır:** (1) can
1 saatte 1 kendiliğinden yenileniyor (`calc_regen_hearts()`/`get_hearts()`,
BACKEND.md §4.1/§6.6) ve istemci bunu geri sayım olarak gösteriyor (kale
ekranı, ana sayfa, "Canın Bitti" ekranı); (2) can artık quiz bitmeden, her
yanlış cevapta ANINDA `lose_heart()` ile düşüyor (önce bekleyen regen'i
uygulayıp sonra düşürüyor) — önceden yalnız quiz TAMAMLANINCA `finish_quiz`
içinde toplu düşüyordu, bu yüzden kullanıcı canı biterek quiz'i yarıda
bırakırsa can DB'de hiç değişmiyordu ve sonra "can geri geldi" gibi
görünüyordu — artık düzeldi. (Ayrıca can düşme kuralı daha önce değişmişti:
premium artık sınırsız can değil, bkz. `hearts.sql` başlığı.)

**Doğrulama:** SQL Editor'de
`select count(*) from questions;` → 39 görmelisin (30 tarih + 6 coğrafya + 3 felsefe).

## 3. Anahtarları uygulamaya bağla ✅
Dashboard → **Settings → API**:
- `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
- `anon public` anahtarı → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

`atlas-mobile/.env` dosyasına yaz (yapıldı).

## 4. Edge Function'ları deploy et
Kod repo'da hazır: `supabase/functions/coach-chat/`, `supabase/functions/weekly-exam/`,
`supabase/functions/iyzico-pay/`, `supabase/functions/expire-premium/`.

```bash
# repo kökünde (bir kere): Supabase CLI'a login + projeyi bağla
npx supabase login
npx supabase link --project-ref zfhmvlxgrlmripwpawoh

# secret'lar (service role zaten function env'inde otomatik var)
npx supabase secrets set DEEPSEEK_API_KEY=<platform.deepseek.com anahtarın>
npx supabase secrets set CRON_SECRET=<uzun rastgele bir dize>   # weekly-exam + expire-premium koruması
npx supabase secrets set IYZICO_API_KEY=<iyzico sandbox/prod api key>
npx supabase secrets set IYZICO_SECRET_KEY=<iyzico sandbox/prod secret key>
# prod'a geçince: npx supabase secrets set IYZICO_BASE_URL=https://api.iyzipay.com
# (secret set edilmezse sandbox: https://sandbox-api.iyzipay.com varsayılır)

# deploy
npx supabase functions deploy coach-chat
npx supabase functions deploy weekly-exam
npx supabase functions deploy iyzico-pay
npx supabase functions deploy expire-premium
```

### 4a. Haftalık sınav zamanlaması (her Pazar)
Dashboard → **Edge Functions → weekly-exam → Schedules** → cron: `0 9 * * 0`
(Pazar 09:00 UTC ≈ 12:00 TR). Schedule ayarında HTTP header olarak
`x-cron-secret: <CRON_SECRET>` ekle.

Elle test: `curl -X POST https://zfhmvlxgrlmripwpawoh.supabase.co/functions/v1/weekly-exam -H "Authorization: Bearer <anon key>" -H "x-cron-secret: <CRON_SECRET>"`

### 4b. coach-chat notları
- DeepSeek anahtarı **istemciye konmaz** — yalnız bu function'ın env'inde.
- Model: `deepseek-chat` (değiştirmek için `DEEPSEEK_MODEL` secret'ı;
  `deepseek-reasoner` koç sohbeti için yavaş/pahalı — önerilmez).
- Premium olmayan kullanıcıya 403 `premium_required` döner; günlük limit 30 mesaj (429).
- Deneme girişi ayrı uç değil: istemci `mock_exams`e yazar, sonra koça mesaj atar —
  bağlam toplama son denemeyi zaten görür.

### 4c. iyzico-pay + expire-premium notları
- iyzico API key/secret **istemciye konmaz** — yalnız `iyzico-pay` function'ın env'inde.
- Fiyatlar (`PRICES` sabiti, function içinde) sunucuda tanımlı — client hiçbir
  zaman tutar göndermez, yalnız `product` seçer.
- Sandbox test kartlarıyla dene: `npx supabase functions invoke iyzico-pay
  --data '{"product":"hearts_refill","card":{"holderName":"Test User","number":"5528790000000008","expireMonth":"12","expireYear":"30","cvc":"123"}}'`
  (iyzico'nun yayınladığı başarı senaryosu test kartı — gerçek kart no farklıysa
  iyzico Dashboard'daki sandbox test kartları listesine bak).
- İmza hatası (`errorMessage` "Invalid signature" gibi) dönerse: `payment/auth`
  isteğinde giden `bodyString` ile imza hesaplamasındaki string TAM AYNI
  olmalı (function bunu tek değişkende tutuyor, elle değiştirmeyin);
  `x-iyzi-rnd` header'ının `randomKey` ile birebir eşleştiğini doğrulayın.
- Her ödeme denemesi `payments` tablosuna yazılır (başarılı/başarısız fark
  etmeksizin) — "ödeme yaptım ama premium açılmadı" tipi destek taleplerinde
  ilk bakılacak yer burası (`raw_response` iyzico'nun ham cevabını tutar).
- `expire-premium`, `weekly-exam` ile aynı desende günlük zamanlanır: Dashboard
  → Edge Functions → expire-premium → Schedules → cron `0 3 * * *`, header
  `x-cron-secret: <CRON_SECRET>`.

## 5. finish_quiz sözleşmesi (mobil taraf için)
```ts
const { data } = await supabase.rpc('finish_quiz', {
  p_topic_id: topicId,        // weekly/single'da null
  p_mode: 'topic',            // 'topic' | 'weekly' | 'single' | 'flashcards'
  p_answers: [{ question_id, selected_index, correct }, ...],
});
// data: { xp_earned, stars, hearts_left, streak_count }
```
Davranış notları:
- Can artık `finish_quiz` içinde değil, her yanlış cevapta ANINDA `lose_heart()`
  RPC'siyle düşer (istemci: `checkAnswer` yanlışta çağırır) — quiz mode'una
  göre (premium dahil herkes aynı 0-5 tavanına tabi); flashcards can yakmaz.
  `finish_quiz` yalnız güncel can sayısını `hearts_left` olarak raporlar,
  KENDİSİ DÜŞÜRMEZ. Can 1 saatte 1 kendiliğinden yenilenir (`get_hearts()`,
  istemci UI'da geri sayım gösterir) VEYA `refill_hearts()` ile (satın alma)
  anında dolar (BACKEND.md §4.1, karar kesin).
- `single` VE `weekly` modda doğru çözülen soru yanlış havuzundan temizlenir
  (§4.7: haftalık sınav "bekleyenleri çözme" işini üstlenir).
- `weekly` modda bu haftanın `weekly_exams` satırı `completed_at` ile kapanır.
- Konu tekrar oynanırsa yıldız düşmez (greatest).

## 6. Push token kaydı
İstemci `expo-notifications` ile token alır → `profiles.expo_push_token`a yazar
(RLS "own profile" bunu zaten mümkün kılar; ayrı endpoint gerekmez).

## Sıradaki içerik işi
Tarih'in kalan konuları + diğer derslerin içeriği editör işi. Yeni içerik
`units → topics → questions/flashcards` sırasıyla, `sort_order` alanlarına
dikkat ederek SQL Editor'den (service_role) eklenir.
