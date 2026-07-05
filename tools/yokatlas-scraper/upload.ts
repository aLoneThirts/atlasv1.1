/**
 * Aşama 3 — Supabase'e yazma.
 *
 * ÖNEMLİ (Aşama 2'de keşfedildi): `/netler/search`, `/tercih-kilavuz/search`'ün
 * aksine ÇOK YILLI veri döndürüyor — aynı `kilavuzKodu` için genelde 3 satır
 * (2023/2024/2025), her biri o yılın taban puanı + net ortalamalarıyla.
 * Ama kontenjan/yerleşen/başarı sırası YALNIZ `tercih-kilavuz/search`'te var
 * ve o da YALNIZ güncel yılı (2025) veriyor. Bu yüzden:
 *   - Güncel yıl satırı: quota/placed/min_rank + o yılın net_detail'i dolu.
 *   - Geçmiş yıllar (2023/2024): yalnız min_score (tabanPuan) + net_detail
 *     dolu, quota/placed/min_rank null kalır (API'de yok).
 *
 * program_ids.json (tercih-kilavuz/search) + net_details.json (netler/search,
 * çok yıllı) `kilavuzKodu` ile join edilir, `yks_programs` (doğal anahtar:
 * birim_id) + `yks_program_stats` (program_id, year) tablolarına 500'erli
 * batch upsert yapılır.
 *
 * Önce `supabase/yks_programs.sql`'i Supabase SQL Editor'de çalıştırmış olman
 * gerekir. `.env`'de SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY beklenir.
 *
 * Çalıştır: deno task upload  (collect-ids + scrape-details'ten SONRA)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildNetDetail, readJsonCheckpoint } from "./_shared.ts";

const BATCH_SIZE = 500;

type QuotaRow = Record<string, any>;
type NetRow = Record<string, any>;

function scoreTypeDb(puanTuru: string): string {
  return puanTuru === "SÖZ" ? "SOZ" : puanTuru === "DİL" ? "DIL" : puanTuru;
}

async function main() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY .env'de bulunamadı.");
    Deno.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const quotaCheckpoint = await readJsonCheckpoint<{ rows: QuotaRow[] }>("./program_ids.json");
  const netCheckpoint = await readJsonCheckpoint<{ rows: NetRow[] }>("./net_details.json");
  if (!quotaCheckpoint || !netCheckpoint) {
    console.error("program_ids.json / net_details.json bulunamadı — önce collect-ids + scrape-details çalıştırılmalı.");
    Deno.exit(1);
  }

  // kilavuzKodu -> yıl -> net satırı (çok yıllı — bkz. dosya başı notu).
  const netByKilavuzKoduYear = new Map<number, Map<number, NetRow>>();
  for (const row of netCheckpoint.rows) {
    if (!netByKilavuzKoduYear.has(row.kilavuzKodu)) netByKilavuzKoduYear.set(row.kilavuzKodu, new Map());
    netByKilavuzKoduYear.get(row.kilavuzKodu)!.set(row.yil, row);
  }

  // birim_id bazında dedup — aynı program birden fazla sayfada tekrar gelmemeli ama garanti olsun.
  // Bazı satırlarda (özel kota/"TABLO 4" türü — yurtdışı, M.T.O.K. vb. ek kontenjanlar) YÖK Atlas
  // zorunlu alanlardan birini (birimId, birimGrupId, ...) hiç doldurmuyor; yks_programs'ta NOT NULL
  // olan bu alanlardan biri eksikse satırı atlıyoruz (ana veriyi etkilemeyen kenar durumlar).
  const REQUIRED: (keyof QuotaRow)[] = [
    "birimId",
    "birimGrupId",
    "universiteId",
    "universiteAdi",
    "birimAdi",
    "puanTuru",
  ];
  const programsByBirimId = new Map<number, QuotaRow>();
  let skippedMissingField = 0;
  for (const row of quotaCheckpoint.rows) {
    const missing = REQUIRED.some((k) => row[k] === null || row[k] === undefined);
    if (missing) {
      skippedMissingField++;
      continue;
    }
    programsByBirimId.set(row.birimId, row);
  }
  if (skippedMissingField > 0) {
    console.log(`⚠️ zorunlu alanlardan biri eksik olan ${skippedMissingField} satır atlandı (özel kota/tablo türleri).`);
  }

  console.log(`${programsByBirimId.size} benzersiz program, ${netByKilavuzKoduYear.size} programın net verisi bulundu.`);

  const programRows = Array.from(programsByBirimId.values()).map((row) => ({
    birim_id: row.birimId,
    birim_grup_id: row.birimGrupId,
    universite_id: row.universiteId,
    university: row.universiteAdi,
    university_type: row.universiteTuru ?? null,
    city: row.uniIlAdi ?? null,
    faculty: row.fymkAdi ?? null,
    department: row.birimAdi,
    score_type: scoreTypeDb(row.puanTuru),
    language: row.ogrenimDiliAdi ?? null,
    scholarship: row.bursOraniAdi ?? null,
  }));

  console.log(`\n== yks_programs upsert (${programRows.length} satır, ${BATCH_SIZE}'lik batch) ==`);
  const birimIdToProgramId = new Map<number, string>();
  for (let i = 0; i < programRows.length; i += BATCH_SIZE) {
    const batch = programRows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("yks_programs")
      .upsert(batch, { onConflict: "birim_id" })
      .select("id, birim_id");
    if (error) throw new Error(`yks_programs upsert hata: ${error.message}`);
    for (const r of data ?? []) birimIdToProgramId.set(r.birim_id, r.id);
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(programRows.length / BATCH_SIZE)} yazıldı.`);
  }

  const statRows: Record<string, unknown>[] = [];
  for (const row of programsByBirimId.values()) {
    const programId = birimIdToProgramId.get(row.birimId);
    if (!programId) continue;
    const yearsForProgram = netByKilavuzKoduYear.get(row.kilavuzKodu);
    if (!yearsForProgram) {
      // netler/search'te hiç karşılığı yoksa yine de güncel yılı quota/sıra bilgisiyle yaz.
      statRows.push({
        program_id: programId,
        year: row.yil,
        kilavuz_kodu: row.kilavuzKodu,
        quota: row.kontenjan ?? null,
        placed: row.gkY ?? null,
        min_score: row.minPuan ?? null,
        min_rank: row.basariSirasi ?? null,
        avg_tyt_net: null,
        avg_ayt_net: null,
        net_detail: {},
        fee: row.ucret ?? null,
      });
      continue;
    }

    for (const [year, netRow] of yearsForProgram) {
      const { net_detail, avg_tyt_net, avg_ayt_net } = buildNetDetail(netRow);
      const isCurrentYear = year === row.yil; // yalnız güncel yılda kontenjan/yerleşen/sıra mevcut
      statRows.push({
        program_id: programId,
        year,
        kilavuz_kodu: row.kilavuzKodu,
        quota: isCurrentYear ? (row.kontenjan ?? null) : null,
        placed: isCurrentYear ? (row.gkY ?? null) : null,
        min_score: netRow.tabanPuan ?? (isCurrentYear ? row.minPuan : null) ?? null,
        min_rank: isCurrentYear ? (row.basariSirasi ?? null) : null,
        avg_tyt_net,
        avg_ayt_net,
        net_detail,
        fee: isCurrentYear ? (row.ucret ?? null) : null,
      });
    }
  }

  console.log(`\n== yks_program_stats upsert (${statRows.length} satır) ==`);
  for (let i = 0; i < statRows.length; i += BATCH_SIZE) {
    const batch = statRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("yks_program_stats").upsert(batch, { onConflict: "program_id,year" });
    if (error) throw new Error(`yks_program_stats upsert hata: ${error.message}`);
    console.log(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(statRows.length / BATCH_SIZE)} yazıldı.`);
  }

  console.log(`\nTamamlandı: ${birimIdToProgramId.size} program, ${statRows.length} stat satırı yazıldı.`);
}

main();
