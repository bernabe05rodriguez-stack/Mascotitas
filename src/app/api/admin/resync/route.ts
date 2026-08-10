import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Resincroniza el catálogo desde el snapshot versionado del Sheet.
 *
 * Es la herramienta de reparación: si un arranque quedó a medias y el catálogo
 * está incompleto, esto lo deja exactamente como el snapshot. Es idempotente y
 * NO borra nada — sólo hace upsert de lo que está en el snapshot.
 *
 * Se protege con AUTH_SECRET por query, igual que /api/boot: si la base quedó
 * en mal estado, iniciar sesión en el panel puede no ser posible.
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!process.env.AUTH_SECRET || token !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const before = {
    products: await prisma.product.count(),
    variants: await prisma.variant.count(),
    images: await prisma.productImage.count(),
  };

  try {
    // El bundle de arranque expone la misma rutina que usa el contenedor.
    const { normalizeCatalog } = await import('../../../../../scripts/normalize');
    const { writeCatalog, parseCsv, CATALOG_SNAPSHOT, COUPONS_SNAPSHOT } = await import(
      '../../../../../scripts/seed-catalog'
    );

    const catalogCsv = readFileSync(resolve(process.cwd(), CATALOG_SNAPSHOT), 'utf8');
    let couponsCsv: string | null = null;
    try {
      couponsCsv = readFileSync(resolve(process.cwd(), COUPONS_SNAPSHOT), 'utf8');
    } catch {
      /* sin cupones, el catálogo se sincroniza igual */
    }

    const { products, stats } = normalizeCatalog(parseCsv(catalogCsv));
    const result = await writeCatalog(prisma, products, couponsCsv);

    const after = {
      products: await prisma.product.count({ where: { active: true } }),
      variants: await prisma.variant.count(),
      images: await prisma.productImage.count(),
    };

    const ok = after.products >= stats.products && after.variants === stats.variants;

    return NextResponse.json(
      {
        ok,
        esperado: { products: stats.products, variants: stats.variants, images: stats.images },
        antes: before,
        despues: after,
        escritos: result,
      },
      { status: ok ? 200 : 500 },
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message, antes: before }, { status: 500 });
  }
}
