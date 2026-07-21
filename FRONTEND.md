# Atlas — Frontend Geliştirme Dokümanı

> Bu doküman `atlas-mobile/` uygulamasını geliştirecek kişi (ve onun Claude
> oturumu) için yazıldı. Ürün kuralları/veri modeli için BACKEND.md ana
> kaynaktır — burası yalnız istemci mimarisini, ekran haritasını ve
> state/veri kalıplarını anlatır. 2026-07-14'te kod okunarak yazıldı (ilk
> sürüm — önceden bu dosya yoktu, yalnız BACKEND.md vardı).
> **2026-07-20'de "Engagement paketi" (07-16'da eklenen rozetler/bildirimler/
> deneme sekmesi/hedefli pratik quiz) ve o tarihten beri kod okunarak
> güncellendi — bkz. §2, §7, §8.**

---

## 1. Stack

| Katman | Teknoloji |
|---|---|
| Framework | React Native 0.86 + Expo SDK 57 (`expo-router` ~57, dosya tabanlı routing) |
| Dil | TypeScript, React 19.2 |
| Backend istemcisi | `@supabase/supabase-js` v2 (`src/lib/supabase.ts`) |
| Navigasyon | `expo-router` — `Stack` + `Stack.Protected` (auth/onboarding gate'leri) + `NativeTabs` (alt sekme) |
| Fontlar | Nunito (başlık/CTA, `expo-google-fonts/nunito`) + Inter (gövde, `expo-google-fonts/inter`) |
| Animasyon | `react-native-reanimated` tabanlı özel bileşenler (`components/ui/animated/`) |
| Bildirimler | `expo-notifications` (push token + yerel günlük sınav geri sayımı) |
| Görseller | `expo-image` |
| Paylaşılan kod | `../shared/yks-calc.ts`, `../shared/rank-estimator.ts` — Metro `metro.config.js` `watchFolders` ile repo kökünü de izler, `@shared/*` alias'ıyla import edilir (Deno Edge Function'larla AYNI dosya, iki kez yazılmaz) |

---

## 2. Repo Haritası (`atlas-mobile/`)

```
atlas-mobile/
├── src/
│   ├── app/                        ← expo-router ekranları (dosya = route)
│   │   ├── _layout.tsx             ← Kök layout: font yükleme, AuthProvider,
│   │   │                             ThemeModeProvider, Stack.Protected gate'leri
│   │   ├── giris.tsx                ← Giriş/Kayıt (e-posta+şifre VEYA Google)
│   │   ├── auth-callback.tsx        ← Google OAuth dönüş ekranı
│   │   ├── onboarding.tsx           ← İlk giriş: kullanıcı adı/ad-soyad/sınav
│   │   │                             kapsamı/hedef okul/KVKK onayı
│   │   ├── hukuki.tsx               ← Gizlilik Politikası/Kullanım Şartları (modal)
│   │   ├── ayarlar.tsx              ← Ayarlar: sınav kapsamı, hedef okul/bölüm,
│   │   │                             premium durumu, hesap silme
│   │   ├── premium.tsx              ← Premium satın alma vitrin ekranı
│   │   ├── odeme.tsx                ← Kart formu + iyzico ödeme (modal)
│   │   ├── tercih.tsx               ← Tercih Robotu (en düşük/en yüksek sıralama
│   │   │                             aralığı → o aralıktaki programlar, 2026-07-14
│   │   │                             revizyonu — eski risk-bantlı model kaldırıldı)
│   │   ├── rozetler.tsx             ← Rozetlerim (tam liste) — Ev ekranındaki
│   │   │                             teaser'dan açılır (2026-07-16)
│   │   ├── bildirimler.tsx          ← Bildirim gelen kutusu — Ev ekranındaki 🔔
│   │   │                             ikonundan açılır (2026-07-16)
│   │   ├── deneme/quiz-hedef.tsx    ← Deneme sonrası "zayıf konular" hedefli
│   │   │                             pratik quiz (2026-07-16, bkz. BACKEND.md §6.8)
│   │   ├── (tabs)/                  ← Alt sekmeler (NativeTabs)
│   │   │   ├── _layout.tsx          ← AppTabs (Ev/Harita/Koç/Yanlışlar/Puan/Deneme)
│   │   │   ├── index.tsx            ← Ev: streak/can/günlük XP + "Devam Et" +
│   │   │   │                          rozet teaser'ı + 🔔 bildirim ikonu
│   │   │   ├── harita.tsx           ← İnce route dosyası, gerçek mantık
│   │   │   │                          components/map/map-screen.tsx'te
│   │   │   ├── koc.tsx              ← AI koç sohbeti (DeepSeek proxy) + katlanır
│   │   │   │                          "Deneme Sonucu Gir" formu (net + zayıf konu
│   │   │   │                          seçici) + "Bu Hafta" özet çipi
│   │   │   ├── yanlislar.tsx        ← Yanlış havuzu listesi
│   │   │   ├── puan.tsx             ← YKS puan hesaplama + tercih robotu linki +
│   │   │   │                          okul/bölüm sırala
│   │   │   └── deneme.tsx           ← Deneme Net Takibi (trend grafiği + geçmiş) —
│   │   │                              Puan'dan ayrı, kendi sekmesi (2026-07-16)
│   │   ├── kale/[subjectId]/
│   │   │   ├── index.tsx            ← Ders içi konu ağacı (üniteler/konular)
│   │   │   ├── ozet.tsx             ← Konu özeti (yalnız seed_tarih_full.sql
│   │   │   │                          yüklenmiş konularda `topics.summary` dolu)
│   │   │   ├── quiz.tsx             ← Quiz faz makinesi (loading/quiz/
│   │   │   │                          hearts-empty/result/error)
│   │   │   └── kartlar.tsx          ← Flashcard (yazılı cevap) tekrarı
│   │   └── yanlislar/
│   │       ├── haftalik.tsx         ← Haftalık sınav giriş ekranı
│   │       ├── quiz-haftalik.tsx    ← Haftalık sınav quiz akışı
│   │       └── quiz-tekil.tsx       ← Tek soruluk yanlış çözme akışı
│   ├── components/
│   │   ├── app-tabs.tsx (+.web.tsx) ← NativeTabs tanımı
│   │   ├── badges/                  ← badge-grid.tsx (rozetler.tsx ızgarası),
│   │   │                              badge-unlock-popup.tsx (kutlama popup'ı,
│   │   │                              Ev + tüm quiz sonuç ekranlarında)
│   │   ├── hearts/hearts-empty-card.tsx  ← "Canın Bitti" kartı + formatCountdown()
│   │   ├── koc/weak-topics-picker.tsx  ← Ders→bölüm→konu 3 seviyeli akordeon seçici
│   │   │                              (Koç'taki "Deneme Sonucu Gir" formunda)
│   │   ├── score/net-trend-chart.tsx  ← Elle çizilmiş SVG çizgi grafik (Deneme
│   │   │                              sekmesi) — proje içinde grafik kütüphanesi YOK
│   │   ├── map/                     ← Harita çizimi (kale düğümü, yollar, boss kale,
│   │   │                              dekorasyon, layout hesaplama) — dışa açılan
│   │   │                              tek export `map-screen.tsx`'teki `MapScreen`
│   │   ├── payment/card-form.tsx    ← iyzico kart giriş formu (yalnız UI, veri
│   │   │                              hiç saklanmaz — bkz. BACKEND.md §7)
│   │   ├── premium/premium-benefits.tsx  ← Premium vitrin liste bileşeni
│   │   ├── ui/                      ← Btn3D, Card, ProgressBar, HeartsRow, Pill,
│   │   │                              DateField, Collapsible, GlowHalo
│   │   └── ui/animated/             ← Confetti, FireBadge (streak), GlowBanner,
│   │                                  MascotPop, PulsingBadge, TypingDots (koç "yazıyor…")
│   ├── constants/
│   │   ├── atlas-theme.ts           ← TÜM tasarım token'ları (bkz. §5)
│   │   └── tr-cities.ts             ← Tercih robotu şehir filtresi için il listesi
│   ├── hooks/use-color-scheme.ts(.web.ts), use-theme.ts, use-tab-badges.ts
│   │             (Yanlışlar sekmesi kırmızı sayı rozeti, 60sn polling — 2026-07-16)
│   └── lib/
│       ├── supabase.ts              ← Supabase istemcisi (env: EXPO_PUBLIC_*)
│       ├── auth-context.tsx         ← AuthProvider/useAuth (bkz. §4.1)
│       ├── auth-google.ts           ← Google OAuth akışı
│       ├── theme-context.tsx        ← ThemeModeProvider/useThemeMode (açık/koyu)
│       ├── queries.ts               ← TEK veri katmanı — tüm Supabase çağrıları
│       │                              burada (bkz. §4.2, BACKEND.md'nin istemci
│       │                              karşılığı)
│       ├── purchases.ts             ← iyzico-pay çağrıları (hearts/premium/ads)
│       ├── push-notifications.ts    ← Expo push token kaydı
│       ├── exam-countdown-notification.ts ← Günlük yerel "sınavına X gün kaldı" bildirimi
│       ├── map-progress.ts          ← Harita düğüm durumu türetme yardımcıları
│       ├── navigation.ts            ← `safeGoBack()` — geçmiş yoksa (doğrudan
│       │                             URL/derin link) fallback rotaya gider,
│       │                             tüm "‹ Geri" butonları bunu kullanır (2026-07-14)
│       └── types.ts                 ← Supabase satırlarının TS karşılıkları
│           (Database type üretimi YOK — elle senkron tutulur, bkz. §7)
├── .env                             ← EXPO_PUBLIC_SUPABASE_URL / ANON_KEY (dolu)
├── metro.config.js                  ← watchFolders: repo kökü (`../shared` importu için)
└── package.json                     ← expo ~57.0.4, react-native 0.86, react 19.2
```

---

## 3. Routing ve Auth Gate'leri

`_layout.tsx` üç `Stack.Protected` bloğu ile yönlendirmeyi TAMAMEN
bildirimsel yapıyor — hiçbir ekranda elle `router.replace()` ile
auth-yönlendirmesi YOK:

```
guard: !!session && onboardingCompleted === true   → (tabs), ayarlar, premium, tercih, odeme
guard: !!session && onboardingCompleted === false  → onboarding
guard: !session                                     → giris
```

`auth-callback` (Google dönüşü) ve `hukuki` (modal) bu guard'ların dışında,
her zaman erişilebilir. `initializing` (AsyncStorage'dan ilk oturum okuması)
VEYA `session && onboardingCompleted === null` (profil henüz çekilmedi) iken
`RootNavigator` `null` döner — native splash ekranda kalır, yanlış ekrana
"sıçrama" (flicker) olmaz.

**Kritik akış notu:** `onboardingCompleted` state'i yalnız `refreshOnboarding()`
(auth-context.tsx) çağrılınca güncellenir — `onboarding.tsx` kaydettikten
sonra bunu elle çağırır (`await refreshOnboarding()`), yoksa kullanıcı
onboarding'de kilitli kalır.

---

## 4. State ve Veri Kalıpları

### 4.1 Global state — yalnız 2 React Context, başka store YOK

- **`AuthProvider`** (`auth-context.tsx`): `session`, `initializing`,
  `onboardingCompleted`. Redux/Zustand/Jotai kullanılmıyor — bilinçli basit
  tutulmuş.
- **`ThemeModeProvider`** (`theme-context.tsx`): açık/koyu mod tercihi
  (yalnız "açık zeminli" ekranlar tepki verir, bkz. §5).

Ekran/lokal state HER YERDE `useState` + `useEffect`/`useFocusEffect` —
React Query/SWR gibi bir veri-cache kütüphanesi YOK. Kalıp (ör. `(tabs)/index.tsx`):

```ts
const load = useCallback(async () => { /* Promise.all ile paralel fetch */ }, []);
useFocusEffect(useCallback(() => { load(); }, [load]));  // sekmeye her dönüşte tazele
```

Bu, ekranlar arası cache paylaşımı olmadığı anlamına gelir — her ekran kendi
verisini kendi çeker. Küçük/orta ölçekli bir uygulama için bilinçli bir
basitlik tercihi, büyürse (çok ekran aynı veriyi çekiyorsa) React Query'ye
geçiş değerlendirilebilir.

### 4.2 `lib/queries.ts` — tek veri katmanı

Hiçbir ekran `supabase.from(...)`u DOĞRUDAN çağırmaz (birkaç basit
`updateProfile`/`signOut` istisnası dışında) — hepsi `queries.ts`'teki
adlandırılmış fonksiyonlardan geçer. Bu dosya BACKEND.md'nin istemci
karşılığıdır; iş kuralı YOKTUR (o sunucuda: RPC'ler + RLS), yalnızca
sorgu + tip dönüşümü + birkaç türetilmiş hesap (§4.5 "efektif active konu"
gibi) içerir. Yeni bir backend özelliği eklendiğinde BURAYA bir fonksiyon
eklemek repo konvansiyonu.

**Optimistic update kalıbı** (`ayarlar.tsx`, `onPickExamTrack`):
```ts
const previous = examTrack;
setExamTrackState(track);          // önce UI güncellenir
try { await setExamTrack(track); }
catch { setExamTrackState(previous); setError(...); }  // hata olursa geri al
```
Bu kalıp birkaç ekranda tekrarlanıyor — yeni bir "anında hissettiren" yazma
eklenecekse aynı deseni kullan.

### 4.3 Hata gösterimi

Network/RPC hatalarında genelde Türkçe, kullanıcıya aksiyon öneren tek satır
(`"... internetini kontrol edip tekrar dene."`) — teknik hata mesajı asla
gösterilmiyor. `sendCoachMessage`/`payWithIyzico` gibi Edge Function
çağrılarında sunucunun döndürdüğü hata KODU (`premium_required`,
`rate_limited`, `payment_failed` vb.) yakalanıp ekrana özel Türkçe metne
çevriliyor (bkz. `koc.tsx`/`odeme.tsx` — tam eşlemeyi orada doğrula).

---

## 5. Tasarım Sistemi (`constants/atlas-theme.ts`)

Kaynak: `atlas_fable_brief.md` §3 (Göktuğ'da) — prototipin (`index.html`)
CSS değişkenlerinin RN karşılığı, tek dosyada toplanmış:

- **`AtlasColors`** — Duolingo'ya yakın canlı palet (green/yellow/red/blue/
  purple/orange) + nötr gri tonları + 2 koyu ekran arkaplanı (`coachBg`,
  `cardsBg` — Koç ve Kartlar ekranları HER ZAMAN koyu, moddan bağımsız).
- **`SubjectColors`** — her ders/kale için sabit renk+emoji (ör. tarih ⚔️
  turuncu, coğrafya 🌍 yeşil) — `subjects.color`/`emoji` DB'den gelir ama bu
  sabit harita tasarım referansı.
- **`AtlasSurface.light`/`.dark`** — **yalnız** Ev/Yanlışlarım/Kale ekranları
  karanlık moda tepki verir (`useThemeMode()` + `AtlasSurface[mode]`); Quiz/
  Koç/Giriş/Harita zaten koyu tasarlandığı için sabit kalır — bu bilinçli bir
  tutarsızlık, "hepsini dark mode'a bağla" gibi bir refactor YAPILMAMALI
  (tasarım kararı).
- **`AtlasGradients`** — ekran bazlı gradyan setleri (onboarding, harita,
  can-bitti kırmızısı, haftalık sınav girişi, boss kale altın/AYT moru).
- **`Press3D`/`ledgeShadow()`** — Duolingo'nun imza "3D buton" efekti (alt
  gölge + basılınca 5px kayma) — `Btn3D` bileşeni bunu kullanır.
- **`AtlasFonts`** — Nunito (başlık/rakam, ağır) + Inter (gövde) — ikisi de
  `expo-font` ile `_layout.tsx`'te yüklenir, yüklenene kadar `null` render
  edilir (splash ekranda kalır).

---

## 6. Bileşen Kütüphanesi (öne çıkanlar)

| Bileşen | Ne işe yarar |
|---|---|
| `Btn3D` | Ana CTA butonu — varyantlar: default/ghost/orange/blue/yellow/red |
| `Card` | Standart yüzey kartı (surface'a göre bg/border) |
| `HeartsRow` / `hearts-empty-card.tsx` | Can göstergesi + `formatCountdown()` (sonraki can yenilenmesine kalan süre metni — Ev, Kale, Canın Bitti 3 yerde kullanılır) |
| `ProgressBar` | Günlük XP hedefi, quiz ilerleme çubukları |
| `DateField` | Sınav tarihi seçici (onboarding + ayarlar'da aynı bileşen) |
| `map/*` | Fetih haritası çizimi — `map-layout.ts` düğüm konumlarını hesaplar, `boss-castle.tsx` dersin son kalesi (TYT Ana Kalesi / AYT boss), `map-decorations.tsx` süs objeleri |
| `ui/animated/Confetti` | Quiz/haftalık sınav sonucu kutlaması |
| `ui/animated/FireBadge` | Streak (seri) rozeti, Ev ekranında |
| `ui/animated/TypingDots` | Koç "yazıyor…" göstergesi |
| `payment/card-form.tsx` | iyzico kart formu — `odeme.tsx` bunu sarar |
| `premium/premium-benefits.tsx` | Premium vitrin liste öğeleri |

---

## 7. Ekran ↔ Backend Eşleşmesi (hızlı referans)

| Ekran | Kullandığı backend | BACKEND.md § |
|---|---|---|
| `giris.tsx` | `auth.signUp`/`signInWithPassword`, `signInWithGoogle`, `is_username_available` | §7, username.sql |
| `onboarding.tsx` | `set_exam_track`, `updateProfile` (username/ad-soyad/hedef/terms_accepted_at), `is_username_available` | §4.9, §7 |
| `(tabs)/index.tsx` | `fetchProfile`, `fetchXpToday`, `fetchContinueTarget`, `fetchOpenMistakeCount`, `getHearts`, `fetchUnreadNotificationCount`, `fetchBadges`/`checkAndAwardBadges` | §4.1, §4.3, §6.8 |
| `(tabs)/harita.tsx` (→ `map-screen.tsx`) | `fetchSubjectSummaries`, `fetchProfile` (TYT/AYT toggle için `exam_track`), `map-progress.ts` | §4.5 |
| `(tabs)/koc.tsx` | `sendCoachMessage` (coach-chat Edge Fn), `fetchCoachHistory`, `fetchWeeklySummary`, `saveMockExam` (+`weak_topic_ids`), `fetchSubjects`/`fetchSubjectTree` (WeakTopicsPicker) | §6.3, §6.8 |
| `(tabs)/yanlislar.tsx` | `fetchOpenMistakes`, `fetchProfile` (AYT toggle) | §4.6 |
| `(tabs)/puan.tsx` | `calculateAndSaveExamScore`, `fetchScoreRankDistribution`/`fetchAvailableRankYears` (+`rank-estimator.ts`), `searchYksPrograms`, `fetchProgramStats` | §11.1, §11.2 |
| `(tabs)/deneme.tsx` | `fetchMockExamHistory` (yalnız okuma — giriş `koc.tsx`'te) | §6.8 |
| `deneme/quiz-hedef.tsx` | `fetchQuestionsByTopics`, `finishQuiz(mode:'weak_topics')`, `loseHeart`, `getHearts`, `checkAndAwardBadges` | §6.1, §6.8 |
| `rozetler.tsx` | `fetchBadges` | §6.8 |
| `bildirimler.tsx` | `fetchNotifications`, `markNotificationsRead` | §6.8 |
| `tercih.tsx` | `fetchTercihSiraAraligi` (`tercih_sira_araligi` RPC, bkz. `tercih_aralik.sql`) | §11.1 |
| `kale/[subjectId]/*` | `fetchSubjectTree`, `fetchTopicSummary`, `fetchTopicQuestions`, `finishQuiz`, `loseHeart`, `getHearts`, `fetchFlashcardsByTopic`, `checkAndAwardBadges` | §4.5, §4.8, §6.1, §6.8 |
| `yanlislar/haftalik*` | `fetchCurrentWeeklyExam`, `finishQuiz(mode:'weekly')`, `checkAndAwardBadges` | §4.7, §6.2, §6.8 |
| `yanlislar/quiz-tekil.tsx` | `fetchQuestionById`, `finishQuiz(mode:'single')`, `checkAndAwardBadges` | §4.6, §6.1, §6.8 |
| `premium.tsx` / `odeme.tsx` | `purchases.ts` → iyzico-pay Edge Fn | §4.9, §6.6 |
| `ayarlar.tsx` | `setExamTrack`, `updateProfile`, `deleteAccount` | §4.9, §7 |

---

## 8. Bilinen Açık İşler / Riskler (2026-07-20 itibarıyla)

1. **`shared/rank-estimator.ts` kesinlik uyarısı UI'da doğrulanmalı** —
   kod içi yorum "~yaklaşık" ibaresi + ÖSYM uyarısı ŞART diyor;
   `(tabs)/puan.tsx`'te bu mevcut, ama gelecekte ekran değişirse bu uyarı
   metninin kalması gerekir.
2. **`hukuki.tsx`'te destek e-postası hâlâ placeholder** (`[destek e-postası
   eklenecek]`) — Göktuğ şirket maili çıkınca dolduracak (bkz. proje hafızası).
3. **Veri cache/senkron yok** — her ekran kendi verisini `useFocusEffect`'te
   tazeliyor; iki ekran aynı anda açıksa (ör. sekme geçişleri hızlıysa) aynı
   veri iki kez çekilebilir. Şu an kullanıcı sayısı/performans açısından
   sorun değil, büyürse React Query değerlendirilebilir (§4.1).
4. **`lib/types.ts` elle senkron** — Supabase'de `npx supabase gen types`
   ile otomatik tip üretimi KURULMADI; şema değişince bu dosyayı elle
   güncellemeyi unutma — Engagement paketi (badges/notifications/
   weak_topic_ids, bkz. BACKEND.md §6.8) 2026-07-16'da eklenirken zaten
   yapıldı, ama sonraki her migration için tekrar gerekir.
5. **`seed_tarih_full.sql` yüklenmediği için `ozet.tsx` (konu özeti ekranı)
   çoğu konuda boş/null dönebilir** — `fetchTopicSummary` null-safe ama
   ekranın bu durumda ne gösterdiği ayrıca doğrulanmalı (bkz. BACKEND.md §6.7).
6. ~~`supabase/tercih_aralik.sql` henüz çalıştırılmadı~~ → **ÇÖZÜLDÜ (2026-07-14),**
   `tercih_sira_araligi` RPC canlıda doğrulandı.
7. ~~Koç sekmesindeki "Deneme Sonucu Gir" formunda Matematik alanı yoktu~~ →
   **ÇÖZÜLDÜ (2026-07-20).** TYT'nin en ağırlıklı dersi (40 soru) net girişine
   eklendi (`(tabs)/koc.tsx` `DENEME_FIELDS`) — önceden yalnız Türkçe/Tarih/
   Coğrafya/Felsefe/Fen vardı, hiçbir Matematik neti kaydedilemiyordu. Canlı
   `mock_exams` verisiyle doğrulandı (mevcut kayıtların `nets`'inde hiç
   "Matematik" anahtarı yoktu). `tsc --noEmit` temiz, Expo web bundler
   hatasız derledi (dev server ile doğrulandı).
8. **`streak-reminder` Edge Function'ının deploy/cron durumu doğrulanmadı**
   — dosya repoda var (bkz. BACKEND.md §6.8) ama Supabase Dashboard'da
   schedule kurulu mu ayrıca kontrol edilmeli; ayrıca push zaten `eas.
   projectId` eksikliği yüzünden hiçbir cihaza ulaşmıyor (BACKEND.md §6.7
   madde 8) — yalnız uygulama içi bildirim gelen kutusu çalışıyor.
9. ~~`app-tabs.tsx` altı sekmeyi mi yansıtıyor doğrulanmalı~~ → **doğrulandı
   (2026-07-20).** `app-tabs.tsx` gerçekten 6 sekme tanımlıyor (Ev/Harita/Koç/
   Yanlışlar/Puan/Deneme) + Yanlışlar sekmesinde `useTabBadges()` hook'undan
   gelen kırmızı sayı rozeti (`hooks/use-tab-badges.ts`, `fetchOpenMistakeCount`'ı
   60sn'de bir polling ile tazeler — `(tabs)/_layout.tsx` odak döngüsü yaşamadığı
   için `useFocusEffect` yerine bilinçli bir `setInterval` kullanılmış). Bu
   dosya önceki FRONTEND.md sürümünde hiç belgelenmemişti.

---

## 9. Hızlı Başlangıç (frontend geliştirici)

```bash
cd atlas-mobile
npm install
# .env zaten dolu (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY) — BACKEND.md §10'daki
# canlı proje ile eşleşiyor, ayrıca bir şey kurman gerekmiyor.
npx expo start
# iOS: i tuşu (simulator) — Android: a tuşu — web: w tuşu (kısıtlı, native
# özellikler — NativeTabs, push, iyzico kart formu — web'de tam çalışmayabilir)
```

Yeni bir ekran eklerken: `src/app/` altına dosya eklemek yeterli
(expo-router otomatik route yaratır); yeni bir backend çağrısı gerekiyorsa
önce `queries.ts`'e fonksiyon ekle, ekrandan doğrudan `supabase.from(...)`
çağırma (repo konvansiyonu, §4.2).
