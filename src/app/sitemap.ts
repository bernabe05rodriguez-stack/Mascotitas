import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mascotitas.online';

/**
 * Sitemap generado desde la base. El anterior era un XML fijo con una sola URL,
 * porque el sitio entero era una sola página.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.category.findMany({ where: { active: true }, select: { slug: true } }),
    prisma.brand.findMany({ select: { slug: true } }),
  ]);

  return [
    { url: SITE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/catalogo`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    ...categories.map((c) => ({
      url: `${SITE}/catalogo?category=${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...brands.map((b) => ({
      url: `${SITE}/catalogo?brand=${b.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...products.map((p) => ({
      url: `${SITE}/producto/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
