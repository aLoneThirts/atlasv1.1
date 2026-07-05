/**
 * Ortak yardımcılar — tüm scraper adımları bunu kullanır.
 * ⚠️ yokatlas.yok.gov.tr API'si `yil` filtresini YOK SAYIYOR (Aşama 1/2'de
 * doğrulandı — 1999 dahil hangi yıl gönderilirse gönderilsin yalnız güncel
 * kılavuz döneminin verisi dönüyor). Bu yüzden hiçbir yerde `yil` filtresi
 * GÖNDERMİYORUZ; her satırın kendi `yil` alanını (API'nin döndürdüğü,
 * şu an 2025) gerçek kaynak olarak kullanıyoruz. 2023/2024 bu API'den
 * ALINAMIYOR — bkz. supabase/yks_programs.sql başlığı ve README.md.
 */

export const API_BASE = "https://yokatlas.yok.gov.tr/api";
export const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; AtlasYKS-scraper/0.1; +internal-tool)",
};

/** Lisansta gerçekten var olan puan türleri (TYT yalnız önlisansta — doğrulandı, lisansta 0 sonuç). */
export const SCORE_TYPES = ["SAY", "EA", "SÖZ", "DİL"] as const;
export type ScoreType = (typeof SCORE_TYPES)[number];

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 3 deneme + exponential backoff. */
export async function postWithRetry(path: string, body: unknown, attempt = 1): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (attempt >= 3) throw e;
    const backoff = 1000 * 2 ** attempt;
    console.warn(`  ⚠️  ${path} denemesi ${attempt} başarısız (${e}), ${backoff}ms sonra tekrar...`);
    await sleep(backoff);
    return postWithRetry(path, body, attempt + 1);
  }
}

/**
 * Bir arama endpoint'ini (tercih-kilavuz/search | netler/search) filtresiyle
 * TAMAMEN sayfalar (size:500), her sayfa arası rate-limit bekler, tüm
 * satırları biriktirip döner. Progress konsola yazılır.
 */
export async function fetchAllPages(
  path: string,
  filters: Record<string, unknown>,
  label: string,
): Promise<any[]> {
  const size = 500;
  let page = 0;
  let all: any[] = [];
  let totalElements = Infinity;

  while (page * size < totalElements) {
    const data = await postWithRetry(path, { filters, page, size });
    totalElements = data.totalElements ?? 0;
    all = all.concat(data.content ?? []);
    console.log(`  ${label} — sayfa ${page + 1}/${Math.ceil(totalElements / size)} (${all.length}/${totalElements})`);
    page += 1;
    if (page * size < totalElements) await sleep(550);
  }
  return all;
}

export async function writeJsonCheckpoint(path: string, data: unknown): Promise<void> {
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2));
}

export async function readJsonCheckpoint<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await Deno.readTextFile(path)) as T;
  } catch {
    return null;
  }
}

/** BACKEND.md standart net_detail anahtarları — API alan adı -> standart anahtar. */
export const NET_FIELD_MAP: Record<string, string> = {
  tytTrkNet: "tyt_turkce",
  tytSosNet: "tyt_sosyal",
  tytMatNet: "tyt_matematik",
  tytFenNet: "tyt_fen",
  aytMatNet: "ayt_matematik",
  aytFizNet: "ayt_fizik",
  aytKimNet: "ayt_kimya",
  aytBioNet: "ayt_biyoloji",
  aytTdeNet: "ayt_edebiyat",
  aytTrh1Net: "ayt_tarih1",
  aytCog1Net: "ayt_cografya1",
  aytTrh2Net: "ayt_tarih2",
  aytCog2Net: "ayt_cografya2",
  aytFelNet: "ayt_felsefe",
  aytDinNet: "ayt_dkab",
  ydtYdilNet: "ydt",
};

const TYT_KEYS = ["tyt_turkce", "tyt_sosyal", "tyt_matematik", "tyt_fen"];

/** Ham netler/search satırından standart net_detail + avg_tyt_net/avg_ayt_net türetir. */
export function buildNetDetail(netRow: Record<string, unknown>): {
  net_detail: Record<string, number>;
  avg_tyt_net: number | null;
  avg_ayt_net: number | null;
} {
  const net_detail: Record<string, number> = {};
  for (const [apiKey, stdKey] of Object.entries(NET_FIELD_MAP)) {
    const v = netRow[apiKey];
    if (typeof v === "number") net_detail[stdKey] = v;
  }
  const tytVals = TYT_KEYS.filter((k) => k in net_detail).map((k) => net_detail[k]);
  const aytVals = Object.entries(net_detail)
    .filter(([k]) => !TYT_KEYS.includes(k))
    .map(([, v]) => v);

  return {
    net_detail,
    avg_tyt_net: tytVals.length > 0 ? round2(tytVals.reduce((a, b) => a + b, 0)) : null,
    avg_ayt_net: aytVals.length > 0 ? round2(aytVals.reduce((a, b) => a + b, 0)) : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** score_type normalize — dosya adları/JSON key'lerinde Türkçe karakter sorunu çıkarmasın diye. */
export function normalizeScoreType(puanTuru: string): string {
  return puanTuru === "SÖZ" ? "SOZ" : puanTuru === "DİL" ? "DIL" : puanTuru;
}
