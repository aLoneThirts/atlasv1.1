# Atlas — YKS Hazırlık Uygulaması

Duolingo mekanikleri + kale fethi temalı YKS uygulaması. Türkçe UI, hedef kitle 16-19 yaş.

- **Backend geliştiriyorsan önce `BACKEND.md`yi oku** — ürün kuralları, veri modeli,
  Edge Function spec'leri ve yol haritası orada. Şema: `supabase/schema.sql`.
- `index.html` = çalışan tasarım prototipi (tüm ekranlar + örnek içerik verileri).
  Davranış sorularında referans budur.
- `atlas-mobile/` = Expo SDK 57 RN iskeleti (expo-router, 4 sekme, tasarım
  token'ları `src/constants/atlas-theme.ts`).
- İş kuralları Europe/Istanbul saatine göre; ders id'leri text slug ('tarih', 'turkce'...).
- Monetizasyon: yalnız Tarih dersi ücretsiz; koç + haftalık sınav + diğer dersler premium.
