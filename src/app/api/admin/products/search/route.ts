import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Búsqueda rápida de productos para el punto de venta.
 * GET /api/admin/products/search?q=royal+canin
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  const terms = q.split(/\s+/).filter(Boolean);
  const where = {
    active: true,
    AND: terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: 'insensitive' as const } },
        { brand: { name: { contains: t, mode: 'insensitive' as const } } },
      ],
    })),
  };

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      stock: true,
      images: { select: { url: true }, take: 1, orderBy: { order: 'asc' } },
      brand: { select: { name: true } },
      variants: {
        select: { id: true, label: true, price: true, originalPrice: true },
        orderBy: { order: 'asc' },
      },
    },
    take: 10,
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(products);
}
