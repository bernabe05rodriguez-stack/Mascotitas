/**
 * Baja las imágenes del catálogo de postimg.cc y las deja servidas por nosotros.
 *
 * Hasta ahora las 305 fotos del catálogo vivían en un hosting gratuito de
 * terceros: si postimg.cc se cae o borra una imagen, se pierde el catálogo
 * visual entero y no hay copia. Esto lo arregla.
 *
 * De cada original genera dos WebP (400px para las cards, 900px para la ficha)
 * y actualiza ProductImage.url apuntando a la copia propia. `legacyUrl` queda
 * intacto, así que el script se puede re-correr.
 *
 *   npx tsx scripts/fetch-images.ts [--force] [--concurrency 6]
 */

import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const UPLOAD_DIR = resolve(process.cwd(), 'public/uploads');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const CONCURRENCY = Number(args[args.indexOf('--concurrency') + 1]) || 6;

const SIZES = [
  { suffix: 'sm', width: 400 },
  { suffix: 'lg', width: 900 },
];

interface Result {
  id: string;
  ok: boolean;
  reason?: string;
  bytesIn?: number;
  bytesOut?: number;
}

async function download(url: string, attempt = 1): Promise<Buffer> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MascotitasBot/1.0)' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (attempt >= 3) throw err;
    await new Promise((r) => setTimeout(r, 800 * attempt));
    return download(url, attempt + 1);
  }
}

async function processImage(img: { id: string; url: string; legacyUrl: string | null }): Promise<Result> {
  const source = img.legacyUrl ?? img.url;

  if (!/^https?:\/\//.test(source)) {
    return { id: img.id, ok: false, reason: 'no es una URL absoluta' };
  }

  // Nombre determinístico: la misma URL siempre da el mismo archivo.
  const hash = createHash('sha1').update(source).digest('hex').slice(0, 16);
  const relBase = `/uploads/${hash}`;

  const alreadyDone = SIZES.every((s) => existsSync(resolve(UPLOAD_DIR, `${hash}-${s.suffix}.webp`)));
  if (alreadyDone && !FORCE) {
    if (img.url !== `${relBase}-lg.webp`) {
      await prisma.productImage.update({ where: { id: img.id }, data: { url: `${relBase}-lg.webp` } });
    }
    return { id: img.id, ok: true, reason: 'ya existía' };
  }

  const buf = await download(source);
  let bytesOut = 0;

  for (const size of SIZES) {
    const out = await sharp(buf)
      .rotate()
      .resize({ width: size.width, height: size.width, fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' }) // las fotos vienen con fondo blanco embebido
      .webp({ quality: 82 })
      .toBuffer();
    writeFileSync(resolve(UPLOAD_DIR, `${hash}-${size.suffix}.webp`), out);
    bytesOut += out.length;
  }

  await prisma.productImage.update({
    where: { id: img.id },
    data: { url: `${relBase}-lg.webp`, legacyUrl: source },
  });

  return { id: img.id, ok: true, bytesIn: buf.length, bytesOut };
}

async function main() {
  mkdirSync(UPLOAD_DIR, { recursive: true });

  const images = await prisma.productImage.findMany({
    select: { id: true, url: true, legacyUrl: true },
    orderBy: { id: 'asc' },
  });
  console.log(`\n=== Rescate de imágenes ===`);
  console.log(`Imágenes en la base: ${images.length}`);
  console.log(`Destino: ${UPLOAD_DIR}`);
  console.log(`Concurrencia: ${CONCURRENCY}${FORCE ? ' | --force' : ''}\n`);

  const results: Result[] = [];
  let done = 0;

  // Pool simple: N workers consumiendo de la misma cola.
  const queue = [...images];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const img = queue.shift();
        if (!img) return;
        try {
          results.push(await processImage(img));
        } catch (err) {
          results.push({ id: img.id, ok: false, reason: (err as Error).message });
        }
        done++;
        if (done % 25 === 0) process.stdout.write(`  ${done}/${images.length}\n`);
      }
    }),
  );

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const bytesIn = ok.reduce((n, r) => n + (r.bytesIn ?? 0), 0);
  const bytesOut = ok.reduce((n, r) => n + (r.bytesOut ?? 0), 0);

  console.log(`\n--- Resultado ---`);
  console.log(`  descargadas OK : ${ok.length}`);
  console.log(`  fallidas       : ${failed.length}`);
  if (bytesIn) {
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    console.log(`  peso original  : ${mb(bytesIn)} MB`);
    console.log(`  peso WebP (x2) : ${mb(bytesOut)} MB`);
  }

  if (failed.length) {
    console.log('\n  Fallidas (quedan apuntando a postimg.cc, el sitio sigue andando):');
    for (const f of failed.slice(0, 30)) {
      const img = images.find((i) => i.id === f.id);
      console.log(`    - ${f.reason}  ${img?.legacyUrl ?? img?.url}`);
    }
    process.exitCode = 1;
  } else {
    console.log('\n  ✓ Todas las imágenes están alojadas por nosotros.\n');
  }

  const stillExternal = await prisma.productImage.count({ where: { url: { startsWith: 'http' } } });
  console.log(`  imágenes que todavía dependen de terceros: ${stillExternal}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
