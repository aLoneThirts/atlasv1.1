// score_coefficients'e gerçek ÖSYM katsayılarını yükler — template.csv'yi
// okuyup Supabase'e upsert eder. Hiçbir dış siteye istek atmaz.
// Çalıştır: node load.mjs   (bu klasörden)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const SUBJECT_KEYS = [
  'tyt_turkce', 'tyt_sosyal', 'tyt_matematik', 'tyt_fen',
  'ayt_matematik', 'ayt_fizik', 'ayt_kimya', 'ayt_biyoloji',
  'ayt_edebiyat', 'ayt_tarih1', 'ayt_cografya1', 'ayt_tarih2', 'ayt_cografya2',
  'ayt_felsefe', 'ayt_dkab', 'ydt',
];

function loadEnv(envPath) {
  const env = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((key, i) => (row[key] = (cells[i] ?? '').trim()));
    return row;
  });
}

async function main() {
  const env = loadEnv(join(HERE, '../yokatlas-scraper/.env'));
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.includes('YOUR-')) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tools/yokatlas-scraper/.env icinde bulunamadi.');
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(join(HERE, 'template.csv'), 'utf-8'));

  const payload = [];
  const skipped = [];
  for (const row of rows) {
    if (!row.base_score) {
      skipped.push(`${row.year} ${row.score_type} (base_score bos)`);
      continue;
    }
    const coefficients = {};
    for (const key of SUBJECT_KEYS) {
      const v = row[key];
      if (v !== '' && v !== undefined) coefficients[key] = Number(v);
    }
    if (Object.keys(coefficients).length === 0) {
      skipped.push(`${row.year} ${row.score_type} (ders katsayisi bos)`);
      continue;
    }
    payload.push({
      year: Number(row.year),
      score_type: row.score_type,
      base_score: Number(row.base_score),
      coefficients,
    });
  }

  if (skipped.length > 0) {
    console.log(`Bos oldugu icin atlanan satirlar (${skipped.length}):`);
    for (const s of skipped) console.log(`  - ${s}`);
  }
  if (payload.length === 0) {
    console.log('\nYuklenecek dolu satir yok - template.csv icin README.md talimatlarina bak.');
    return;
  }

  console.log(`\n${payload.length} satir Supabase'e yazilacak...`);
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/score_coefficients?on_conflict=year,score_type`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`Yukleme hatasi: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }
  const data = await res.json();
  console.log(`Tamamlandi: ${data.length} satir yazildi.`);
}

main();
