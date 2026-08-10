import { prisma } from './db';

/**
 * Recalcula los campos derivados de Product a partir de sus variantes.
 *
 * Existen para poder ordenar y paginar por precio directamente en SQL. Hay que
 * llamarlo después de cualquier cambio en variantes o stock: la migración, el
 * alta/edición desde el panel y la edición rápida de precios lo hacen.
 */
export async function recomputeAggregates(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, variants: { select: { price: true, originalPrice: true } } },
  });
  if (!product) return;

  const prices = product.variants.map((v) => v.price);

  await prisma.product.update({
    where: { id: productId },
    data: {
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      onSale: product.variants.some((v) => v.originalPrice != null),
      available: product.stock > 0,
    },
  });
}

/** Versión masiva, para la migración. Evita 268 round-trips innecesarios. */
export async function recomputeAllAggregates(): Promise<number> {
  const products = await prisma.product.findMany({
    select: { id: true, stock: true, variants: { select: { price: true, originalPrice: true } } },
  });

  await prisma.$transaction(
    products.map((p) => {
      const prices = p.variants.map((v) => v.price);
      return prisma.product.update({
        where: { id: p.id },
        data: {
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          onSale: p.variants.some((v) => v.originalPrice != null),
          available: p.stock > 0,
        },
      });
    }),
  );

  return products.length;
}
