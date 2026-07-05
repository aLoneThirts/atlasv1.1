/**
 * Orkestrasyon — collect-ids → scrape-details → upload sırayla çalıştırır.
 * Her adım kendi checkpoint dosyasını (program_ids.json / net_details.json)
 * kullanır; bu script'i tekrar çalıştırmak zaten tamamlanmış puan türlerini
 * atlar. Adımları ayrı ayrı da çalıştırabilirsin: `deno task collect-ids`,
 * `deno task scrape-details`, `deno task upload`.
 *
 * Çalıştır: deno task run-all
 */
async function run(name: string, path: string) {
  console.log(`\n========== ${name} ==========`);
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--env-file=.env", path],
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    console.error(`✗ ${name} başarısız (exit ${code}) — durduruldu.`);
    Deno.exit(code);
  }
}

async function main() {
  await run("collect-ids", "./collect-ids.ts");
  await run("scrape-details", "./scrape-details.ts");
  await run("upload", "./upload.ts");
  console.log("\n✓ Tüm aşamalar tamamlandı.");
}

main();
