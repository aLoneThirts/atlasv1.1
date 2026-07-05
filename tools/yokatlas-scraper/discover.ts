/**
 * Aşama 1 — endpoint keşfi/doğrulama.
 *
 * YÖK Atlas'ın resmi API'si yok; bu, sitenin kendi React SPA'sının kullandığı
 * gerçek (public, auth gerektirmeyen) API'sidir — tarayıcı bundle'ı
 * (static/js/main.*.js) içinden çıkarılıp gerçek isteklerle doğrulandı.
 * Detaylar: README.md.
 *
 * Bu script iki gerçek programı (Boğaziçi Üniversitesi İktisat + İstanbul
 * Medipol Üniversitesi Tıp) uçtan uca çeker, iki endpoint'i kilavuzKodu
 * üzerinden birleştirip konsola yazdırır — Aşama 2/3'te kullanılacak birleştirme
 * mantığının ("join") ispatı.
 */

const API_BASE = "https://yokatlas.yok.gov.tr/api";
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; AtlasYKS-scraper/0.1; +internal-tool)",
};

async function postSearch(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}`);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Sample = { label: string; birimGrupId: number; universiteId: number; puanTuru: string };

const SAMPLES: Sample[] = [
  { label: "Boğaziçi Üniversitesi — İktisat (EA)", birimGrupId: 3353, universiteId: 105322, puanTuru: "EA" },
  { label: "İstanbul Medipol Üniversitesi — Tıp (SAY)", birimGrupId: 5370, universiteId: 163888, puanTuru: "SAY" },
];

async function main() {
  console.log("== YÖK Atlas endpoint keşfi — Aşama 1 doğrulama ==\n");

  for (const sample of SAMPLES) {
    console.log(`--- ${sample.label} ---`);

    // 1) tercih-kilavuz/search — kontenjan, yerleşen, taban puan/sıra, burs, şehir
    const quota = await postSearch("/tercih-kilavuz/search", {
      filters: { birimGrupId: sample.birimGrupId, universiteId: sample.universiteId, yil: 2025 },
      page: 0,
      size: 10,
    });
    await sleep(600);

    // 2) netler/search — ders bazlı ortalama netler (aynı kilavuzKodu ile eşleşir)
    const netler = await postSearch("/netler/search", {
      filters: {
        birimGrupId: sample.birimGrupId,
        universiteId: sample.universiteId,
        puanTuru: sample.puanTuru,
        yil: 2025,
      },
      page: 0,
      size: 10,
    });
    await sleep(600);

    const netByKilavuzKodu = new Map<number, any>();
    for (const row of netler.content ?? []) netByKilavuzKodu.set(row.kilavuzKodu, row);

    for (const row of quota.content ?? []) {
      const net = netByKilavuzKodu.get(row.kilavuzKodu);
      console.log(
        JSON.stringify(
          {
            kilavuzKodu: row.kilavuzKodu,
            birimAdi: row.birimAdi,
            puanTuru: row.puanTuru,
            sehir: row.uniIlAdi,
            burs: row.bursOraniAdi ?? (row.bursOraniId === 0 ? null : `id:${row.bursOraniId}`),
            kontenjan: row.kontenjan,
            yerlesen_genel: row.gkY,
            minPuan: row.minPuan,
            basariSirasi: row.basariSirasi,
            net_ortalamalari: net
              ? Object.fromEntries(
                  Object.entries(net).filter(([k]) => k.endsWith("Net")),
                )
              : "EŞLEŞME YOK (kilavuzKodu netler/search'te bulunamadı)",
          },
          null,
          2,
        ),
      );
    }
    console.log();
  }

  console.log(
    "Not: Bu ikisi DIŞINDA (öğrenci profili — cinsiyet/coğrafi bölge/mezuniyet yılı dağılımı)\n" +
      "gösteren bir UI bileşeni bundle'da bulundu (net_ortalamalari, old_grad_count, new_grad_count\n" +
      "alanları), ama bu veriyi dolduran ayrı bir API endpoint'i keşfedilemedi — bundle'da yalnızca\n" +
      "14 endpoint (8 benzersiz taban yol) bulundu, hepsi burada/README'de listeli. Muhtemelen bu\n" +
      "profil verisi ya kaldırılmış bir özellik ya da auth gerektiren bir uçtan geliyor. Aşama 2/3\n" +
      "için engel değil — kullanıcının istediği tüm alanlar (taban puan/sıra, kontenjan, yerleşen,\n" +
      "burs, şehir, puan türü, ders bazlı net ortalamaları) yukarıdaki 2 endpoint'te mevcut.",
  );
}

main();
