# Atlas — Backend (Supabase) Kurulumu

## 1. Proje aç
1. [supabase.com](https://supabase.com) → New Project (bölge: `eu-central-1` Frankfurt, Türkiye'ye en yakın).
2. Veritabanı şifresini bir yere kaydet.

## 2. SQL'leri sırayla yükle ✅ (schema yüklendi)
Dashboard → **SQL Editor** → dosya içeriğini yapıştır → Run. **Sıra önemli:**

| # | Dosya | Ne yapar | Durum |
|---|---|---|---|
| 1 | `schema.sql` | 13 tablo + RLS + ders seed'leri | ✅ yüklendi |
| 2 | `finish_quiz.sql` | Atomik quiz bitirme RPC'si (BACKEND.md §6.1) | ⬜ çalıştır |
| 3 | `seed_tarih.sql` | Tarih 6 konu/30 soru/12 kart + Coğrafya-Felsefe test içeriği | ⬜ çalıştır |

`finish_quiz.sql` tekrar çalıştırılabilir (create or replace); `seed_tarih.sql`
idempotenttir — Tarih içeriği zaten varsa hiçbir şey yazmaz.

**Doğrulama:** SQL Editor'de
`select count(*) from questions;` → 39 görmelisin (30 tarih + 6 coğrafya + 3 felsefe).

## 3. Anahtarları uygulamaya bağla ✅
Dashboard → **Settings → API**:
- `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
- `anon public` anahtarı → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

`atlas-mobile/.env` dosyasına yaz (yapıldı).

## 4. Edge Function'ları deploy et
Kod repo'da hazır: `supabase/functions/coach-chat/` ve `supabase/functions/weekly-exam/`.

```bash
# repo kökünde (bir kere): Supabase CLI'a login + projeyi bağla
npx supabase login
npx supabase link --project-ref zfhmvlxgrlmripwpawoh

# secret'lar (service role zaten function env'inde otomatik var)
npx supabase secrets set DEEPSEEK_API_KEY=<platform.deepseek.com anahtarın>
npx supabase secrets set CRON_SECRET=<uzun rastgele bir dize>   # weekly-exam koruması

# deploy
npx supabase functions deploy coach-chat
npx supabase functions deploy weekly-exam
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
- Can yalnız yanlış başına düşer; premium'da düşmez; flashcards can yakmaz.
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
