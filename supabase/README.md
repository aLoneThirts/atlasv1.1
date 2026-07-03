# Atlas — Backend (Supabase) Kurulumu

## 1. Proje aç
1. [supabase.com](https://supabase.com) → New Project (bölge: `eu-central-1` Frankfurt, Türkiye'ye en yakın).
2. Veritabanı şifresini bir yere kaydet.

## 2. Şemayı yükle
Dashboard → **SQL Editor** → `schema.sql` içeriğini yapıştır → Run.
Tablolar: profiles, subjects, units, topics, questions, flashcards,
topic_progress, quiz_attempts, mistakes, xp_events, coach_messages,
mock_exams, weekly_exams. RLS açık, ders seed'leri dahil.

## 3. Anahtarları uygulamaya bağla
Dashboard → **Settings → API**:
- `Project URL` → `EXPO_PUBLIC_SUPABASE_URL`
- `anon public` anahtarı → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

`atlas-mobile/.env.example` → `.env` olarak kopyala, değerleri doldur.

## 4. Haftalık sınav bildirimi (her Pazar)
1. Edge Function `weekly-exam`: kullanıcı başına o haftanın çözülmemiş
   `mistakes` kayıtlarından 5 soru seçer → `weekly_exams` satırı yazar →
   `profiles.expo_push_token`'a Expo Push API ile bildirim atar.
2. Zamanlama: Dashboard → Edge Functions → Schedules → cron `0 9 * * 0`
   (Pazar 09:00 UTC ≈ 12:00 TR).

## 5. Koç (AI) — sonraki adım
Brief §11: Gemini Flash (sohbet) + Flash Lite (bildirim metinleri).
Gemini API anahtarı **istemciye konmaz**; `coach-chat` adlı Edge Function
üzerinden proxy'lenir (kullanıcı verisi + son mesajlar → Gemini → cevap
`coach_messages`e yazılır).

## Sıradaki içerik işi
`questions` ve `flashcards` tablolarına Tarih dersinin içeriği seed edilecek —
prototipteki (index.html) TOPIC_QS, WEEKLY_QS ve CARDS_BY_TOPIC verileri
başlangıç seti olarak kullanılabilir.
