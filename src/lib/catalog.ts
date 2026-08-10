import { Prisma } from '@prisma/client';
import { prisma } from './db';

export const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  stock: true,
  featured: true,
  petType: true,
  brand: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  variants: {
    orderBy: { order: 'asc' },
    select: { id: true, label: true, price: true, originalPrice: true, stock: true },
  },
  images: { orderBy: { order: 'asc' }, take: 2, select: { url: true, alt: true } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof PRODUCT_CARD_SELECT }>;

export interface CatalogFilters {
  q?: string;
  category?: string;
  brand?: string;
  pet?: string;
  sort?: string;
  onlyOffers?: boolean;
  page?: number;
  perPage?: number;
}

/**
 * Una categoría padre (ej: Accesorios) tiene que traer también lo de sus hijas
 * (Juguetes, Sanitarios…), o filtrar por ella devolvería cero productos.
 */
async function categorySlugsWithChildren(slug: string): Promise<string[]> {
  const cat = await prisma.category.findUnique({
    where: { slug },
    select: { slug: true, children: { select: { slug: true } } },
  });
  if (!cat) return [slug];
  return [cat.slug, ...cat.children.map((c) => c.slug)];
}

export async function getCatalog(filters: CatalogFilters) {
  const perPage = filters.perPage ?? 24;
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.ProductWhereInput = { active: true };

  if (filters.q) {
    const terms = filters.q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    // Todos los términos tienen que aparecer en algún lado: buscar
    // "royal mini" no puede traer todos los "mini" del catálogo.
    where.AND = terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: 'insensitive' as const } },
        { description: { contains: t, mode: 'insensitive' as const } },
        { brand: { name: { contains: t, mode: 'insensitive' as const } } },
        { category: { name: { contains: t, mode: 'insensitive' as const } } },
      ],
    }));
  }

  if (filters.category) {
    where.category = { slug: { in: await categorySlugsWithChildren(filters.category) } };
  }
  if (filters.brand) where.brand = { slug: filters.brand };
  if (filters.pet === 'perro' || filters.pet === 'gato') {
    where.petType = filters.pet === 'perro' ? 'PERRO' : 'GATO';
  }
  if (filters.onlyOffers) where.onSale = true;

  // Lo agotado siempre al final — un catálogo que arranca con productos que no
  // se pueden comprar es un catálogo que no vende. Y como `available` es una
  // columna real, el orden sobrevive a la paginación.
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ available: 'desc' }];
  switch (filters.sort) {
    case 'precio-asc':
      orderBy.push({ minPrice: 'asc' });
      break;
    case 'precio-desc':
      orderBy.push({ minPrice: 'desc' });
      break;
    case 'nombre':
      orderBy.push({ name: 'asc' });
      break;
    case 'nuevos':
      orderBy.push({ createdAt: 'desc' });
      break;
    default:
      orderBy.push({ featured: 'desc' }, { order: 'asc' });
  }
  orderBy.push({ id: 'asc' }); // desempate estable: sin esto, dos páginas pueden repetir un producto

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: PRODUCT_CARD_SELECT,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return {
    products,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, active: true },
    include: {
      brand: true,
      category: { include: { parent: true } },
      variants: { orderBy: { order: 'asc' } },
      images: { orderBy: { order: 'asc' } },
    },
  });
}

export async function getRelatedProducts(productId: string, categoryId: string, brandId: string | null) {
  // Primero de la misma marca, y se completa con la misma categoría.
  const sameBrand = brandId
    ? await prisma.product.findMany({
        where: { active: true, brandId, id: { not: productId }, stock: { gt: 0 } },
        select: PRODUCT_CARD_SELECT,
        take: 4,
      })
    : [];

  if (sameBrand.length >= 4) return sameBrand;

  const fill = await prisma.product.findMany({
    where: {
      active: true,
      categoryId,
      stock: { gt: 0 },
      id: { notIn: [productId, ...sameBrand.map((p) => p.id)] },
    },
    select: PRODUCT_CARD_SELECT,
    take: 4 - sameBrand.length,
  });

  return [...sameBrand, ...fill];
}

export async function getFeaturedProducts(limit = 8) {
  const featured = await prisma.product.findMany({
    where: { active: true, featured: true, stock: { gt: 0 } },
    select: PRODUCT_CARD_SELECT,
    orderBy: { order: 'asc' },
    take: limit,
  });
  if (featured.length > 0) return featured;

  // Igual que antes: si nadie marcó destacados en el panel, el carrusel no
  // puede quedar vacío. Se completa con ofertas y después con lo que haya.
  const offers = await prisma.product.findMany({
    where: { active: true, stock: { gt: 0 }, variants: { some: { originalPrice: { not: null } } } },
    select: PRODUCT_CARD_SELECT,
    take: limit,
  });
  if (offers.length >= limit) return offers;

  const rest = await prisma.product.findMany({
    where: { active: true, stock: { gt: 0 }, id: { notIn: offers.map((o) => o.id) } },
    select: PRODUCT_CARD_SELECT,
    orderBy: { order: 'asc' },
    take: limit - offers.length,
  });
  return [...offers, ...rest];
}

export async function getFilterOptions() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        icon: true,
        parentId: true,
        _count: { select: { products: { where: { active: true } } } },
      },
    }),
    prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, _count: { select: { products: { where: { active: true } } } } },
    }),
  ]);

  return {
    categories: categories.filter((c) => c._count.products > 0 || categories.some((k) => k.parentId === c.id)),
    brands: brands.filter((b) => b._count.products > 0),
  };
}

