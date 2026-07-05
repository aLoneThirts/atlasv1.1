/**
 * Aşama 2b — ders bazlı net ortalamaları.
 * `/netler/search`i puan türü başına TAMAMEN sayfalar (size:500), her satırı
 * `kilavuzKodu`suyla `net_details.json`'a checkpoint olarak yazar. collect-ids.ts
 * ile aynı sayfalama mantığı — birimGrupId/universiteId bazında TEK TEK istek
 * atmaya gerek yok, geniş sorgu tüm satırları döndürüyor (Aşama 2 keşfinde
 * doğrulandı).
 *
 * Çalıştır: deno task scrape-details (collect-ids'ten SONRA, ama bağımsız da
 * çalışabilir — yalnız netler/search'ü çeker, join upload.ts'te yapılır)
 */
import { fetchAllPages, SCORE_TYPES, normalizeScoreType, writeJsonCheckpoint, readJsonCheckpoint } from "./_shared.ts";

const CHECKPOINT_PATH = "./net_details.json";

type Checkpoint = {
  done: string[];
  rows: Record<string, unknown>[];
};

async function main() {
  const checkpoint = (await readJsonCheckpoint<Checkpoint>(CHECKPOINT_PATH)) ?? { done: [], rows: [] };

  for (const scoreType of SCORE_TYPES) {
    const key = normalizeScoreType(scoreType);
    if (checkpoint.done.includes(key)) {
      console.log(`✓ ${scoreType} zaten tamamlanmış (checkpoint), atlanıyor.`);
      continue;
    }

    console.log(`\n== ${scoreType} — /netler/search taranıyor ==`);
    const rows = await fetchAllPages("/netler/search", { puanTuru: scoreType }, scoreType);
    checkpoint.rows = checkpoint.rows.concat(rows);
    checkpoint.done.push(key);
    await writeJsonCheckpoint(CHECKPOINT_PATH, checkpoint);
    console.log(`✓ ${scoreType}: ${rows.length} satır kaydedildi (toplam birikmiş: ${checkpoint.rows.length}).`);
  }

  console.log(`\nTamamlandı. Toplam net satırı: ${checkpoint.rows.length} → ${CHECKPOINT_PATH}`);
}

main();
