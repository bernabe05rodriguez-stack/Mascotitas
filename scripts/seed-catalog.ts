/**
 * Escritura del catálogo normalizado en la base.
 *
 * Vive separado de `migrate-sheet.ts` porque lo usan dos caminos distintos:
 *  - la migración manual (con informe, dry-run y flags), y
 *  - el arranque del contenedor, que siembra una base vacía.
 *
 * Es idempotente: matchea por `legacyId` cuando el producto lo tenía en la
 * planilla y por `slug` cuando no, así que se puede correr las veces que haga falta.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import Papa from 'papaparse';
import type { PrismaClient } from '@prisma/client';
import {
  normalizeCatalog,
  TOP_CATEGORIES,
  ACCESORIOS_SUBCATEGORIES,
  slugify,
  type SheetRow,
  type NormalizedProduct,
} from './normalize';

export const CATALOG_SNAPSHOT = 'data/catalogo-snapshot-2026-08-10.csv';
export const COUPONS_SNAPSHOT = 'data/cupones-snapshot-2026-08-10.csv';

/**
 * Traduce la URL externa de una foto a su copia propia, si la tenemos.
 *
 * Las 305 fotos del catálogo vivían en postimg.cc, un hosting gratuito de
 * terceros. `fetch-images.ts` las bajó a `data/images/` con un nombre
 * determinístico: sha1 de la URL original. Acá se recalcula ese nombre y, si el
 * archivo está, se apunta a la copia local.
 *
 * Va en la siembra y no sólo en el script de descarga porque la siembra
 * REEMPLAZA las filas de imágenes: si la traducción viviera únicamente en
 * `fetch-images.ts`, cada re-siembra devolvería el catálogo a postimg.cc.
 * (Que es exactamente lo que pasó la primera vez que se deployó.)
 */
function localImageUrl(sourceUrl: string): string | null {
  if (!/^https?:\/\//.test(sourceUrl)) return sourceUrl; // ya es local
  const hash = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 16);
  const file = `${hash}-lg.webp`;
  const enRepo = existsSync(resolve(process.cwd(), 'data/images', file));
  const enVolumen = existsSync(resolve(process.env.UPLOADS_DIR ?? resolve(process.cwd(), 'uploads'), file));
  return enRepo || enVolumen ? `/uploads/${file}` : null;
}

export function parseCsv(text: string): SheetRow[] {
  const out = Papa.parse<SheetRow>(text, { header: true, skipEmptyLines: true });
  for (const e of out.errors.slice(0, 5)) console.warn(`  ! CSV: ${e.message} (fila ${e.row})`);
  return out.data;
}

export interface WriteResult {
  categories: number;
  brands: number;
  products: number;
  variants: number;
  images: number;
  /** Cuántas de esas imágenes se sirven desde nuestro propio storage. */
  imagenesPropias: number;
  coupons: number;
  deactivated: number;
}

export async function writeCatalog(
  prisma: PrismaClient,
  products: NormalizedProduct[],
  couponsCsv: string | null,
  opts: { prune?: boolean } = {},
): Promise<WriteResult> {
  /* categorías: primero las de primer nivel, después las hijas */
  for (const c of TOP_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, petType: c.petType ?? undefined, icon: c.icon, order: c.order },
      update: { name: c.name, icon: c.icon, order: c.order },
    });
  }
  for (const c of ACCESORIOS_SUBCATEGORIES) {
    const parent = await prisma.category.findUnique({ where: { slug: c.parent! } });
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, icon: c.icon, order: c.order, parentId: parent?.id },
      update: { name: c.name, icon: c.icon, order: c.order, parentId: parent?.id },
    });
  }
  const categories = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));

  /* marcas */
  const brandNames = [...new Set(products.map((p) => p.brand).filter(Boolean) as string[])].sort();
  for (const [i, name] of brandNames.entries()) {
    await prisma.brand.upsert({
      where: { slug: slugify(name) },
      create: { slug: slugify(name), name, order: i },
      update: { name },
    });
  }
  const brands = new Map((await prisma.brand.findMany()).map((b) => [b.name, b.id]));

  /* productos */
  const touched: string[] = [];
  let variantCount = 0;
  let imageCount = 0;
  let localImages = 0;

  for (const [i, p] of products.entries()) {
    const categoryId = categories.get(p.categorySlug);
    if (!categoryId) throw new Error(`Categoría inexistente: ${p.categorySlug}`);

    const existing =
      (p.legacyId ? await prisma.product.findFirst({ where: { legacyId: p.legacyId } }) : null) ??
      (await prisma.product.findUnique({ where: { slug: p.slug } }));

    const data = {
      slug: p.slug,
      name: p.name,
      categoryId,
      brandId: p.brand ? (brands.get(p.brand) ?? null) : null,
      petType: p.petType ?? null,
      stock: p.stock,
      featured: p.featured,
      active: true,
      order: i,
      legacyId: p.legacyId,
      legacyRaw: p.legacyRaw as object,
    };

    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data });

    touched.push(product.id);

    // Variantes e imágenes son datos derivados del Sheet: se reemplazan enteras.
    await prisma.variant.deleteMany({ where: { productId: product.id } });
    await prisma.variant.createMany({
      data: p.variants.map((v) => ({
        productId: product.id,
        label: v.label,
        price: v.price,
        originalPrice: v.originalPrice,
        order: v.order,
      })),
    });
    variantCount += p.variants.length;

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    if (p.images.length) {
      await prisma.productImage.createMany({
        data: p.images.map((source, order) => {
          const local = localImageUrl(source);
          if (local) localImages++;
          return { productId: product.id, url: local ?? source, legacyUrl: source, alt: p.name, order };
        }),
      });
      imageCount += p.images.length;
    }
  }

  /* campos derivados (minPrice/maxPrice/onSale/available) */
  const { recomputeAllAggregates } = await import('../src/lib/aggregates');
  await recomputeAllAggregates();

  let deactivated = 0;
  if (opts.prune) {
    const res = await prisma.product.updateMany({
      where: { id: { notIn: touched }, active: true },
      data: { active: false },
    });
    deactivated = res.count;
  }

  /* cupones */
  let coupons = 0;
  if (couponsCsv) {
    for (const row of parseCsv(couponsCsv)) {
      const code = (row['Codigo'] || row['codigo'] || '').trim().toUpperCase();
      const percent = parseInt((row['Descuento'] || row['descuento'] || '').trim(), 10);
      if (!code || !Number.isFinite(percent)) continue;
      await prisma.coupon.upsert({ where: { code }, create: { code, percent }, update: { percent } });
      coupons++;
    }
  }

  return {
    categories: categories.size,
    brands: brands.size,
    products: touched.length,
    variants: variantCount,
    images: imageCount,
    imagenesPropias: localImages,
    coupons,
    deactivated,
  };
}

/** Camino que usa el arranque del contenedor: lee los snapshots del repo. */
export async function seedFromSnapshot(prisma: PrismaClient): Promise<WriteResult> {
  const catalogCsv = readFileSync(resolve(process.cwd(), CATALOG_SNAPSHOT), 'utf8');
  let couponsCsv: string | null = null;
  try {
    couponsCsv = readFileSync(resolve(process.cwd(), COUPONS_SNAPSHOT), 'utf8');
  } catch {
    console.warn('  ! No se encontró el snapshot de cupones — se sigue sin cupones');
  }

  const { products, stats } = normalizeCatalog(parseCsv(catalogCsv));
  const result = await writeCatalog(prisma, products, couponsCsv);

  console.log(
    `  sembrado: ${result.products} productos, ${result.variants} variantes, ` +
      `${result.images} imágenes (${result.imagenesPropias} propias), ${result.coupons} cupones`,
  );

  // La verificación es el punto: si se perdió algo, que el arranque falle fuerte.
  if (result.products !== stats.products || result.variants !== stats.variants) {
    throw new Error(
      `El catálogo sembrado no coincide con el snapshot: ` +
        `productos ${result.products}/${stats.products}, variantes ${result.variants}/${stats.variants}`,
    );
  }

  return result;
}
