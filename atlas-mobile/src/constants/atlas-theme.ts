/**
 * Atlas tasarım token'ları — kaynak: atlas_fable_brief.md §3
 * Prototipteki (../index.html) CSS değişkenlerinin RN karşılığı.
 */

import { Platform } from 'react-native';

export const AtlasColors = {
  // Ana renkler
  green: '#58CC02',
  greenDark: '#46A302',
  greenShadow: '#3A8D00',
  greenLight: '#D7FFB8',

  yellow: '#FFC800',
  yellowDark: '#C89800',

  red: '#FF4B4B',
  redDark: '#CC3333',
  redLight: '#FFDFE0',

  blue: '#1CB0F6',
  blueDark: '#118AD4',
  blueLight: '#DDF4FF',

  purple: '#CE82FF',
  purpleDark: '#9B5DE5',
  violet: '#4C3BCE',

  orange: '#FF9600',
  orangeDark: '#CC7A00',

  // Nötr
  ink: '#3C3C3C',
  inkStrong: '#1A1A1A',
  gray: '#AFAFAF',
  line: '#E5E5E5',
  card: '#F7F7F7',
  surface: '#F9F9F9',
  white: '#FFFFFF',

  // Karanlık ekran arkaplanları
  coachBg: '#0F1520',
  cardsBg: '#131F24',
} as const;

/** Ders (kale) renkleri — TYT 7 kale + AYT */
export const SubjectColors = {
  tarih:    { main: '#E67E22', dark: '#A04000', emoji: '⚔️' },
  cografya: { main: '#27AE60', dark: '#145A32', emoji: '🌍' },
  felsefe:  { main: '#8E44AD', dark: '#5B2C73', emoji: '🧠' },
  turkce:   { main: '#E74C3C', dark: '#922B21', emoji: '📖' },
  fizik:    { main: '#2980B9', dark: '#1A5276', emoji: '⚛️' },
  kimya:    { main: '#16A085', dark: '#0E6655', emoji: '🧪' },
  biyoloji: { main: '#7CB342', dark: '#33691E', emoji: '🧬' },
  edebiyat: { main: '#C0392B', dark: '#7B241C', emoji: '📚' },
} as const;

export type SubjectId = keyof typeof SubjectColors;

/** Gradyanlar (expo-linear-gradient renk dizileri) */
export const AtlasGradients = {
  onboarding: ['#0F2027', '#203A43', '#2C5364'],
  map: ['#0A1628', '#1A3A5C', '#2E6B9E', '#87CEEB', '#6DB86D', '#3A6B1A'],
  heartsEmpty: ['#1A0000', '#3D0000'],
  weeklyIntro: ['#0D0520', '#1A0A3E', '#2D1B5E'],
  bossGold: ['#FFD700', '#FF8C00'],
  bossAyt: ['#667eea', '#764ba2'],
} as const;

export const AtlasRadius = {
  button: 16,
  card: 20,
  pill: 999,
  castle: 18,
  castleBoss: 24,
  sheet: 28,
  bubble: 18,
} as const;

/** Duolingo 3D buton: alt gölge yüksekliği ve basılınca kayma */
export const Press3D = {
  shadowHeight: 5,
  pressTranslate: 5,
} as const;

export const AtlasFonts = {
  // Nunito (başlık/CTA) ve Inter (gövde) expo-font ile yüklenecek
  heading: 'Nunito_900Black',
  headingBold: 'Nunito_800ExtraBold',
  body: 'Inter_400Regular',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  number: 'Inter_900Black',
} as const;

/** theme.ts'ten taşınan sistem fontu Platform.select'i — sadece `code` metin tipi kullanıyor */
export const SystemFonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
})!;

/** theme.ts'ten taşınan layout token'ları */
export const AtlasLayout = {
  maxContentWidth: 800,
  maxFormWidth: 480,
  bottomTabInset: Platform.select({ ios: 50, android: 80 }) ?? 0,
} as const;

/** theme.ts'teki Spacing skalasının Atlas karşılığı */
export const AtlasSpacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * ThemedText/ThemedView'in kullandığı nötr roller — uygulama ekran bazında koyu/açık
 * tasarımı sabit kodladığı için tek (light) tema yeterli; theme.ts'teki Colors.light
 * ile aynı anahtar isimlerini korur (drop-in replacement).
 */
export const AtlasNeutral = {
  text: AtlasColors.inkStrong,
  textSecondary: AtlasColors.ink,
  background: AtlasColors.white,
  backgroundElement: AtlasColors.surface,
  backgroundSelected: AtlasColors.card,
} as const;

export type ThemeColor = keyof typeof AtlasNeutral;

/**
 * Açık/koyu yüzey paleti — yalnız "açık zemin" ekranlar (Ev, Yanlışlarım, Kale)
 * karanlık moda tepki verir; zaten koyu tasarlanmış ekranlar (Quiz, Koç, Giriş,
 * Harita) her iki modda da aynı kalır.
 */
export const AtlasSurface = {
  light: {
    bg: AtlasColors.surface,
    card: AtlasColors.white,
    cardBorder: AtlasColors.line,
    text: AtlasColors.inkStrong,
    textSecondary: AtlasColors.gray,
  },
  dark: {
    bg: '#0F131A',
    card: '#1A2029',
    cardBorder: '#2A3140',
    text: '#F2F3F5',
    textSecondary: '#8B95A5',
  },
} as const;

export type SurfaceMode = keyof typeof AtlasSurface;
export type Surface = (typeof AtlasSurface)[SurfaceMode];

/** Duolingo tarzı "flat ledge" gölge — native için shadow/elevation, web için ayrıca boxShadow string'i eklenebilir */
export function ledgeShadow(color: string, height: number = Press3D.shadowHeight) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: height,
  } as const;
}

/** RN Web `boxShadow` string karşılığı — piksel-mükemmel web paritesi için ledgeShadow'a ek olarak spread edilebilir */
export function ledgeShadowWeb(color: string, height: number = Press3D.shadowHeight) {
  return { boxShadow: `0 ${height}px 0 ${color}` } as const;
}

/** ThemedText `type` varyantlarının font/size/lineHeight tanımları */
export const AtlasTypeScale = {
  heading: { fontFamily: AtlasFonts.heading, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: AtlasFonts.heading, fontSize: 28, lineHeight: 34 },
  subtitle: { fontFamily: AtlasFonts.headingBold, fontSize: 20, lineHeight: 26 },
  default: { fontFamily: AtlasFonts.body, fontSize: 16, lineHeight: 24 },
  bodySemi: { fontFamily: AtlasFonts.bodySemi, fontSize: 15, lineHeight: 22 },
  number: { fontFamily: AtlasFonts.number, fontSize: 26, lineHeight: 30 },
  small: { fontFamily: AtlasFonts.body, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: AtlasFonts.bodyBold, fontSize: 14, lineHeight: 20 },
} as const;
