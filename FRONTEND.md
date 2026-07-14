# Atlas — Frontend Geliştirme Dokümanı

> Bu doküman `atlas-mobile/` uygulamasını geliştirecek kişi (ve onun Claude
> oturumu) için yazıldı. Ürün kuralları/veri modeli için BACKEND.md ana
> kaynaktır — burası yalnız istemci mimarisini, ekran haritasını ve
> state/veri kalıplarını anlatır. 2026-07-14'te kod okunarak yazıldı (ilk
> sürüm — önceden bu dosya yoktu, yalnız BACKEND.md vardı).

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
│   │   ├── (tabs)/                  ← Alt sekmeler (NativeTabs)
│   │   │   ├── _layout.tsx          ← AppTabs (Ev/Harita/Koç/Yanlışlar/Puan)
│   │   │   ├── index.tsx            ← Ev: streak/can/günlük XP + "Devam Et"
│   │   │   ├── harita.tsx           ← Fetih haritası (kale düğümleri)
│   │   │   ├── koc.tsx              ← AI koç sohbeti (DeepSeek proxy)
│   │   │   ├── yanlislar.tsx        ← Yanlış havuzu listesi
│   │   │   └── puan.tsx             ← YKS puan hesaplama + tercih robotu linki +
│   │   │                             okul/bölüm sırala
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
│   │   ├── hearts/hearts-empty-card.tsx  ← "Canın Bitti" kartı + formatCountdown()
│   │   ├── map/                     ← Harita çizimi (kale düğümü, yollar, boss kale,
│   │   │                              dekorasyon, layout hesaplama)
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
│   ├── hooks/use-color-scheme.ts(.web.ts), use-theme.ts
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
| `(tabs)/index.tsx` | `fetchProfile`, `fetchXpToday`, `fetchContinueTarget`, `fetchOpenMistakeCount`, `getHearts` | §4.1, §4.3 |
| `(tabs)/harita.tsx` | `fetchSubjectSummaries`, `map-progress.ts` | §4.5 |
| `(tabs)/koc.tsx` | `sendCoachMessage` (coach-chat Edge Fn), `fetchCoachHistory` | §6.3 |
| `(tabs)/yanlislar.tsx` | `fetchOpenMistakes` | §4.6 |
| `(tabs)/puan.tsx` | `calculateAndSaveExamScore`, `fetchScoreRankDistribution`/`fetchAvailableRankYears` (+`rank-estimator.ts`), `searchYksPrograms`, `fetchProgramStats` | §11.1, §11.2 |
| `tercih.tsx` | `fetchTercihSiraAraligi` (`tercih_sira_araligi` RPC, bkz. `tercih_aralik.sql`) | §11.1 |
| `kale/[subjectId]/*` | `fetchSubjectTree`, `fetchTopicSummary`, `fetchTopicQuestions`, `finishQuiz`, `loseHeart`, `getHearts`, `fetchFlashcardsByTopic` | §4.5, §4.8, §6.1 |
| `yanlislar/haftalik*` | `fetchCurrentWeeklyExam`, `finishQuiz(mode:'weekly')` | §4.7, §6.2 |
| `premium.tsx` / `odeme.tsx` | `purchases.ts` → iyzico-pay Edge Fn | §4.9, §6.6 |
| `ayarlar.tsx` | `setExamTrack`, `updateProfile`, `deleteAccount` | §4.9, §7 |

---

## 8. Bilinen Açık İşler / Riskler (2026-07-14)

1. **`shared/rank-estimator.ts` kesinlik uyarısı UI'da doğrulanmalı** —
   kod içi yorum "~yaklaşık" ibaresi + ÖSYM uyarısı ŞART diyor;
   `(tabs)/puan.tsx`'te bu mevcut (satır ~309-315), ama gelecekte ekran
   değişirse bu uyarı metninin kalması gerekir.
2. **`hukuki.tsx`'te destek e-postası hâlâ placeholder** (`[destek e-postası
   eklenecek]`) — Göktuğ şirket maili çıkınca dolduracak (bkz. proje hafızası).
3. **Veri cache/senkron yok** — her ekran kendi verisini `useFocusEffect`'te
   tazeliyor; iki ekran aynı anda açıksa (ör. sekme geçişleri hızlıysa) aynı
   veri iki kez çekilebilir. Şu an kullanıcı sayısı/performans açısından
   sorun değil, büyürse React Query değerlendirilebilir (§4.1).
4. **`lib/types.ts` elle senkron** — Supabase'de `npx supabase gen types`
   ile otomatik tip üretimi KURULMADI; şema değişince bu dosyayı elle
   güncellemeyi unutma (özellikle BACKEND.md §11'deki yeni tablolar için
   zaten yapıldı, ama sonraki her migration için tekrar gerekir).
5. **`seed_tarih_full.sql` yüklenmediği için `ozet.tsx` (konu özeti ekranı)
   çoğu konuda boş/null dönebilir** — `fetchTopicSummary` null-safe ama
   ekranın bu durumda ne gösterdiği ayrıca doğrulanmalı (bkz. BACKEND.md §6.7).
6. ~~`supabase/tercih_aralik.sql` henüz çalıştırılmadı~~ → **ÇÖZÜLDÜ (2026-07-14),**
   `tercih_sira_araligi` RPC canlıda doğrulandı.

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
