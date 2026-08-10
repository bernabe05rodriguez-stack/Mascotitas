/**
 * Migración del Google Sheet a Postgres.
 *
 *   npm run migrate:dry     -> normaliza y escribe un informe, NO toca la DB
 *   npm run migrate:sheet   -> escribe en la DB
 *
 * Flags:
 *   --live      baja el CSV en vivo en vez de usar el snapshot de data/
 *   --dry-run   no escribe en la DB
 *   --prune     desactiva (no borra) los productos que ya no están en el Sheet
 *
 * La escritura vive en `seed-catalog.ts`, compartida con el arranque del
 * contenedor: así el catálogo se carga igual desde los dos caminos.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeCatalog } from './normalize';
import { parseCsv, writeCatalog, CATALOG_SNAPSHOT, COUPONS_SNAPSHOT } from './seed-catalog';

const SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTTd2Ked_OEGMeZmPg1zLqpsyJixQv4Oyjzecje-UVXSMjAm7Pb2ZRNzUY3Zu8hsIOl8VBYnup9TS9t/pub?output=csv';
const COUPONS_CSV_URL = SHEET_CSV + '&gid=535828895';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIVE = args.includes('--live');
const PRUNE = args.includes('--prune');

async function loadCsv(url: string, snapshotPath: string): Promise<string> {
  if (!LIVE) return readFileSync(resolve(process.cwd(), snapshotPath), 'utf8');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`No se pudo bajar el CSV (${res.status})`);
  return res.text();
}

function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) {
    const k = key(i);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

async function main() {
  console.log(`\n=== Migración catálogo Mascotitas ===`);
  console.log(`Fuente: ${LIVE ? 'Sheet en vivo' : 'snapshot ' + CATALOG_SNAPSHOT}`);
  console.log(`Modo:   ${DRY_RUN ? 'DRY-RUN (no escribe)' : 'ESCRITURA EN DB'}\n`);

  const rows = parseCsv(await loadCsv(SHEET_CSV, CATALOG_SNAPSHOT));
  const { products, issues, stats } = normalizeCatalog(rows);

  console.log('--- Conteos ---');
  console.log(`  filas en el Sheet : ${stats.rowsInSheet}`);
  console.log(`  filas descartadas : ${stats.rowsSkipped}`);
  console.log(`  productos         : ${stats.products}`);
  console.log(`  variantes         : ${stats.variants}`);
  console.log(`  imágenes          : ${stats.images}`);
  console.log(`  con marca         : ${stats.withBrand}`);
  console.log(`  con descuento     : ${stats.withDiscount}`);
  console.log(`  destacados        : ${stats.featured}\n`);

  const warns = issues.filter((i) => i.level === 'warn');
  const infos = issues.filter((i) => i.level === 'info');
  console.log(`--- Avisos: ${warns.length} warn, ${infos.length} info ---`);
  for (const i of warns) console.log(`  [warn] fila ${i.row} "${i.name}": ${i.message}`);
  if (infos.length) {
    const byMsg = new Map<string, number>();
    for (const i of infos) {
      const key = i.message.replace(/"[^"]*"/g, '"…"');
      byMsg.set(key, (byMsg.get(key) ?? 0) + 1);
    }
    for (const [msg, n] of byMsg) console.log(`  [info] ×${n}  ${msg}`);
  }

  const report = {
    generatedFrom: LIVE ? 'live' : CATALOG_SNAPSHOT,
    stats,
    byCategory: countBy(products, (p) => p.categorySlug),
    byBrand: countBy(products, (p) => p.brand ?? '(sin marca)'),
    byPetType: countBy(products, (p) => p.petType ?? '(indistinto)'),
    issues,
    products,
  };
  const reportPath = resolve(process.cwd(), 'data/migration-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nInforme completo: ${reportPath}`);

  console.log('\n--- Por categoría ---');
  for (const [k, v] of Object.entries(report.byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
  console.log('\n--- Por marca (top 15) ---');
  for (const [k, v] of Object.entries(report.byBrand)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }

  if (DRY_RUN) {
    console.log('\nDRY-RUN: no se escribió nada en la base.\n');
    return;
  }

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    console.log('\n--- Escribiendo en la base ---');
    const couponsCsv = await loadCsv(COUPONS_CSV_URL, COUPONS_SNAPSHOT);
    const result = await writeCatalog(prisma, products, couponsCsv, { prune: PRUNE });

    console.log(`  categorías        : ${result.categories}`);
    console.log(`  marcas            : ${result.brands}`);
    console.log(`  productos         : ${result.products}`);
    console.log(`  cupones           : ${result.coupons}`);
    if (PRUNE) console.log(`  desactivados      : ${result.deactivated}`);

    /* ------------------------------ verificación ------------------------------ */
    console.log('\n--- Verificación post-migración ---');
    const dbProducts = await prisma.product.count({ where: { active: true } });
    const dbVariants = await prisma.variant.count();
    const dbImages = await prisma.productImage.count();
    console.log(`  productos activos en DB : ${dbProducts}  (esperado ${stats.products})`);
    console.log(`  variantes en DB         : ${dbVariants}  (esperado ${stats.variants})`);
    console.log(`  imágenes en DB          : ${dbImages}`);

    const problems: string[] = [];
    if (dbProducts < stats.products) problems.push(`Faltan productos: ${stats.products - dbProducts}`);
    if (dbVariants !== stats.variants) problems.push(`Variantes no coinciden: DB ${dbVariants} vs esperado ${stats.variants}`);

    const sinVariante = await prisma.product.count({ where: { active: true, variants: { none: {} } } });
    if (sinVariante > 0) problems.push(`${sinVariante} productos activos sin ninguna variante`);

    const precioCero = await prisma.variant.count({ where: { price: { lte: 0 } } });
    if (precioCero > 0) problems.push(`${precioCero} variantes con precio <= 0`);

    if (problems.length) {
      console.error('\n  ✗ VERIFICACIÓN FALLIDA:');
      for (const p of problems) console.error(`    - ${p}`);
      process.exitCode = 1;
    } else {
      console.log('\n  ✓ Verificación OK — el catálogo está completo.\n');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nMigración abortada:', err);
  process.exit(1);
});
