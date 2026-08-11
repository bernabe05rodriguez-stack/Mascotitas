import { prisma } from '@/lib/db';
import { PosClient, type PosProduct, type PosCategory } from '@/components/admin/PosClient';

export const dynamic = 'force-dynamic';

/**
 * Punto de venta del local.
 *
 * Antes esta pantalla era sólo un buscador: sin escribir no se veía nada, y
 * escribiendo aparecían 10 resultados alfabéticos. En el mostrador eso obliga a
 * saber de memoria qué se vende — por eso ahora se carga el catálogo entero,
 * ordenado por lo más vendido, y el filtrado se hace en el navegador (son ~270
 * productos: entran de sobra y responde sin esperas entre teclas).
 */
export default async function PosPage() {
  const [rows, categories, sold] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        stock: true,
        category: { select: { slug: true, name: true, parentId: true } },
        brand: { select: { name: true } },
        images: { select: { url: true }, take: 1, orderBy: { order: 'asc' } },
        variants: {
          select: { id: true, label: true, price: true, originalPrice: true, stock: true },
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, parentId: true },
    }),
    // Unidades vendidas por producto. Un pedido cancelado no es una venta, así
    // que no cuenta para el ranking.
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: { order: { status: { not: 'CANCELADO' } } },
    }),
  ]);

  const soldById = new Map<string, number>();
  for (const row of sold) {
    // productId queda en null si el producto se borró: esa venta ya no se puede
    // atribuir a nada del catálogo.
    if (row.productId) soldById.set(row.productId, row._sum.quantity ?? 0);
  }

  // El slug de la categoría madre viaja con cada producto para que el filtro
  // "Accesorios" traiga también lo que vive en sus subcategorías.
  const slugById = new Map(categories.map((c) => [c.id, c.slug]));

  const products: PosProduct[] = rows
    .map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      sold: soldById.get(p.id) ?? 0,
      brand: p.brand?.name ?? null,
      categoryName: p.category.name,
      categorySlug: p.category.slug,
      parentSlug: p.category.parentId ? (slugById.get(p.category.parentId) ?? null) : null,
      image: p.images[0]?.url ?? null,
      variants: p.variants.map((v) => ({
        id: v.id,
        label: v.label,
        price: v.price,
        originalPrice: v.originalPrice,
        stock: v.stock,
      })),
    }))
    // Orden por defecto: lo más vendido primero, y a igual cantidad, alfabético.
    .sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name, 'es'));

  const byId = new Map(categories.map((c) => [c.id, c.slug]));
  const categoryOptions: PosCategory[] = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    parentSlug: c.parentId ? (byId.get(c.parentId) ?? null) : null,
  }));

  return <PosClient products={products} categories={categoryOptions} />;
}
