/**
 * Sıralama tahmini — puan + puan türü + bir yılın (puan,sıra) nokta bulutundan
 * LİNEER İNTERPOLASYONLA yaklaşık başarı sırası hesaplar.
 *
 * Veri kaynağı: supabase/score_rank_distribution.sql (VIEW) — resmi ÖSYM
 * "Puanların ve Sıralamaların Dağılımı" tablosu artık erişilebilir/bulunabilir
 * değildi (bkz. tools/yokatlas-scraper/README.md), bu yüzden kendi topladığımız
 * `yks_program_stats`teki gerçek (min_score, min_rank) çiftleri kullanılıyor —
 * ~32 bin gerçek nokta, resmi tablodan daha granüler bir ampirik eğri verir.
 *
 * ⚠️ VERİ KISITI (gerçek testte doğrulandı): YÖK Atlas API'si başarı sırasını
 * (min_rank) YALNIZ güncel yıl için veriyor; geçmiş yıllarda (2023/2024) yalnız
 * taban puanı var, sıra yok. `score_rank_distribution` VIEW'ı `min_rank is not
 * null` filtresiyle bunu doğru yansıtıyor — pratikte "son yıllar sıralama"
 * şu an tek yıl (güncel dönem) döndürür, 2021-2025 DEĞİL. Var olmayan geçmiş
 * yıl sırası UYDURULMADI. İleride ÖSYM/başka bir kaynak bulunursa buraya
 * eklenebilir; şimdilik bu fonksiyon eldeki hangi yıl varsa onu işler.
 *
 * Ayrıca yıllar arası puan enflasyonu nedeniyle aynı puan farklı yıllarda
 * farklı sıraya denk gelir — bu KESİN bir sıra DEĞİL, yaklaşık bir tahmindir.
 * UI'da mutlaka "~yaklaşık" ibaresi ve "kesin sıra için ÖSYM sonuç belgeni
 * kontrol et" uyarısı gösterilmeli (bkz. puan-hesapla.tsx).
 *
 * atlas-mobile (Metro, watchFolders) bu dosyayı da yks-calc.ts gibi
 * @shared/rank-estimator üzerinden import eder.
 */

export type RankPoint = { score: number; rank: number };

export type RankEstimate = {
  yaklasikSira: number;
  /** Puan, bu yılın veri aralığının dışındaysa true (uç değer döndürüldü, güvenilirlik düşük). */
  tabloDisi: boolean;
};

export type YearlyRankEstimate = RankEstimate & { yil: number };

/**
 * Bir yılın (score,rank) nokta bulutunda `puan`a en yakın alt/üst iki noktayı
 * bulup aralarında lineer geçiş yapar. Puan aralığın dışındaysa uç noktanın
 * sırası döndürülür ve `tabloDisi: true` işaretlenir.
 */
export function tahminSira(puan: number, noktalar: RankPoint[]): RankEstimate {
  if (noktalar.length === 0) return { yaklasikSira: NaN, tabloDisi: true };

  const sorted = [...noktalar].sort((a, b) => a.score - b.score);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (puan <= min.score) return { yaklasikSira: min.rank, tabloDisi: puan < min.score };
  if (puan >= max.score) return { yaklasikSira: max.rank, tabloDisi: puan > max.score };

  let lower = min;
  let upper = max;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].score <= puan && sorted[i + 1].score >= puan) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  if (upper.score === lower.score) return { yaklasikSira: lower.rank, tabloDisi: false };

  const oran = (puan - lower.score) / (upper.score - lower.score);
  const yaklasikSira = lower.rank + oran * (upper.rank - lower.rank);
  return { yaklasikSira, tabloDisi: false };
}

/**
 * `puan` için, verilen her yılın nokta bulutunda ayrı ayrı tahminSira çalıştırır.
 * `dagilimByYear`: yıl -> o yılın (score,rank) noktaları (çağıran taraf,
 * queries.ts üzerinden score_rank_distribution'dan çeker).
 * Sonuç en yeni yıldan en eskiye sıralı döner.
 */
export function sonYillarSira(puan: number, dagilimByYear: Map<number, RankPoint[]>): YearlyRankEstimate[] {
  return [...dagilimByYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([yil, noktalar]) => ({ yil, ...tahminSira(puan, noktalar) }));
}
