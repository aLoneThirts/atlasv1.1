/**
 * ÖSYM YKS puan hesaplama — TEK kaynak modül.
 *
 * Hem atlas-mobile (Metro, bkz. metro.config.js watchFolders) HEM
 * supabase/functions/calculate-yks-score (Deno, doğrudan relative import)
 * bu dosyayı aynen kullanır — formül iki kez yazılmaz, client/server
 * sonuçları birebir aynı çıkar.
 *
 * Katsayılar/base_score KODA GÖMÜLMEZ — `score_coefficients` tablosundan
 * okunur (bkz. supabase/score_coefficients.sql). Bu modül yalnız formülü bilir.
 *
 * net_detail standart anahtarları (score_coefficients.coefficients ve
 * hesaplaHamPuan'a verilen `netler` objesi bu anahtarları kullanır):
 *   tyt_turkce, tyt_sosyal, tyt_matematik, tyt_fen,
 *   ayt_matematik, ayt_fizik, ayt_kimya, ayt_biyoloji,
 *   ayt_edebiyat, ayt_tarih1, ayt_cografya1, ayt_tarih2, ayt_cografya2,
 *   ayt_felsefe, ayt_dkab, ydt
 *
 * ⚠️ score_coefficients seed'indeki değerler PLACEHOLDER'dır (ÖSYM'nin
 * resmi kılavuzundan doğrulanmalı) — bkz. supabase/score_coefficients.sql
 * başındaki uyarı.
 */

export type ScoreType = 'TYT' | 'SAY' | 'EA' | 'SOZ' | 'DIL';

/** Ders anahtarı → net (örn. { tyt_turkce: 32.5, ayt_matematik: 28 }). */
export type NetMap = Record<string, number>;

/** score_coefficients.coefficients kolonunun şekli — ders anahtarı → katsayı. */
export type CoefficientMap = Record<string, number>;

const HAM_PUAN_TAVANI = 500;
const YERLESTIRME_PUANI_TAVANI = 560;

/** Doğru/yanlış → net. Yanlış her 4'te 1 doğruyu götürür, net negatifse 0. */
export function hesaplaNet(dogru: number, yanlis: number): number {
  return Math.max(0, dogru - yanlis / 4);
}

/**
 * Ham puan = base_score + Σ(ders neti × ders katsayısı).
 * `netler`de olup `coefficients`de karşılığı olmayan anahtarlar sessizce
 * atlanır (örn. DİL puan türünde yalnız `ydt` katsayısı olur, TYT anahtarları
 * yine de netler'de bulunabilir ve dahil edilir çünkü TYT her puan türünün
 * bileşenidir — coefficients tablosu bunu zaten yansıtır).
 */
export function hesaplaHamPuan(netler: NetMap, coefficients: CoefficientMap, baseScore: number): number {
  let puan = baseScore;
  for (const [ders, net] of Object.entries(netler)) {
    const katsayi = coefficients[ders];
    if (katsayi !== undefined) puan += net * katsayi;
  }
  return Math.min(puan, HAM_PUAN_TAVANI);
}

/** Diploma notu (0-100) → OBP (250-500). */
export function hesaplaObp(diplomaNotu: number): number {
  return diplomaNotu * 5;
}

/**
 * Yerleştirme puanı = ham puan + OBP katkısı.
 * OBP katkı çarpanı normalde 0.12; kullanıcı önceki yıl bir programa
 * yerleşmişse yarıya iner (0.06) — ÖSYM kuralı.
 */
export function hesaplaYerlestirmePuani(
  hamPuan: number,
  obp: number,
  oncekiYilYerlesti: boolean,
): { obpKatkisi: number; yerlestirmePuani: number } {
  const carpan = oncekiYilYerlesti ? 0.06 : 0.12;
  const obpKatkisi = obp * carpan;
  return { obpKatkisi, yerlestirmePuani: Math.min(hamPuan + obpKatkisi, YERLESTIRME_PUANI_TAVANI) };
}

/** Yalnız EKRANDA gösterirken yuvarla — ara hesaplarda kullanma. */
export function yuvarla(n: number, ondalik = 2): number {
  const carpan = 10 ** ondalik;
  return Math.round(n * carpan) / carpan;
}
