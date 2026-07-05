/**
 * Aşama 2a — program listesi toplama.
 * `/tercih-kilavuz/search`i puan türü başına TAMAMEN sayfalar (size:500),
 * kontenjan/yerleşen/taban puan/burs/şehir gibi tüm alanları `program_ids.json`'a
 * checkpoint olarak yazar. Kesilirse: zaten tamamlanmış puan türlerini atlar
 * (dosyada `done` işaretli score type'ları tekrar çekmez).
 *
 * Çalıştır: deno task collect-ids
 */
import { fetchAllPages, SCORE_TYPES, normalizeScoreType, writeJsonCheckpoint, readJsonCheckpoint } from "./_shared.ts";

const CHECKPOINT_PATH = "./program_ids.json";

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

    console.log(`\n== ${scoreType} — /tercih-kilavuz/search taranıyor ==`);
    const rows = await fetchAllPages("/tercih-kilavuz/search", { puanTuru: scoreType, birimTuruId: 46 }, scoreType);
    checkpoint.rows = checkpoint.rows.concat(rows);
    checkpoint.done.push(key);
    await writeJsonCheckpoint(CHECKPOINT_PATH, checkpoint);
    console.log(`✓ ${scoreType}: ${rows.length} satır kaydedildi (toplam birikmiş: ${checkpoint.rows.length}).`);
  }

  console.log(`\nTamamlandı. Toplam program satırı: ${checkpoint.rows.length} → ${CHECKPOINT_PATH}`);
}

main();
