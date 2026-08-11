import Link from 'next/link';
import { Suspense } from 'react';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { ProductTable } from '@/components/admin/ProductTable';
import { ProductFilters } from '@/components/admin/ProductFilters';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

interface SearchParams {
  q?: string;
  category?: string;
  estado?: string;
  stock?: string;
  sinFoto?: string;
  page?: string;
}

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);

  const categories = await prisma.category.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, parentId: true },
  });

  const where: Prisma.ProductWhereInput = {};

  // Tres estados explícitos. Antes había una casilla "Ver ocultos" que en
  // realidad mostraba visibles + ocultos mezclados, y no había forma de ver
  // sólo los ocultos — que es justo lo que hace falta para volver a mostrarlos.
  if (searchParams.estado === 'ocultos') where.active = false;
  else if (searchParams.estado !== 'todos') where.active = true;

  if (searchParams.q) {
    // Todos los términos tienen que aparecer. Con `contains` de la frase entera,
    // buscar "cordero agility" no encontraba "Agility Adulto Cordero".
    const terms = searchParams.q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    where.AND = terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: 'insensitive' as const } },
        { legacyId: { contains: t } },
        { brand: { name: { contains: t, mode: 'insensitive' as const } } },
        { category: { name: { contains: t, mode: 'insensitive' as const } } },
      ],
    }));
  }

  if (searchParams.category) {
    // Una categoría madre tiene que traer lo de sus hijas: como todos los
    // accesorios viven en subcategorías, filtrar por "Accesorios" devolvía cero.
    const selected = categories.find((c) => c.slug === searchParams.category);
    const slugs = selected
      ? [selected.slug, ...categories.filter((c) => c.parentId === selected.id).map((c) => c.slug)]
      : [searchParams.category];
    where.category = { slug: { in: slugs } };
  }

  if (searchParams.stock === '0') where.stock = 0;
  if (searchParams.sinFoto === '1') where.images = { none: {} };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        variants: { orderBy: { order: 'asc' } },
        images: { orderBy: { order: 'asc' }, take: 1 },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Si un filtro deja menos páginas de las que había, la página actual puede
  // quedar fuera de rango y la tabla se vería vacía sin explicación.
  const outOfRange = page > totalPages && total > 0;

  const buildHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...patch })) if (v) next.set(k, String(v));
    const qs = next.toString();
    return `/admin/productos${qs ? `?${qs}` : ''}`;
  };

  // Las categorías se pasan con el slug de la madre, que es lo que el
  // desplegable necesita para agrupar.
  const byId = new Map(categories.map((c) => [c.id, c.slug]));
  const categoryOptions = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    parentId: c.parentId ? (byId.get(c.parentId) ?? null) : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-navy">Productos</h1>
          <p className="text-sm text-navy/55">Editá precio y stock directo en la tabla</p>
        </div>
        <Link href="/admin/productos/nuevo" className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Nuevo producto
        </Link>
      </div>

      <Suspense fallback={<div className="h-24 rounded-2xl border border-line bg-white" />}>
        <ProductFilters categories={categoryOptions} total={total} />
      </Suspense>

      {outOfRange ? (
        <p className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-navy/60">
          Esta página quedó fuera de rango con los filtros actuales.{' '}
          <Link href={buildHref({ page: undefined })} className="font-semibold text-accent hover:underline">
            Volver a la primera
          </Link>
        </p>
      ) : (
        <ProductTable products={products} />
      )}

      {totalPages > 1 && !outOfRange && (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginación">
          {page > 1 && (
            <Link href={buildHref({ page: page - 1 === 1 ? undefined : String(page - 1) })} className="btn-outline rounded-full px-4 py-2 text-sm font-semibold">
              Anterior
            </Link>
          )}
          <span className="text-sm text-navy/60 tabular">
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Link href={buildHref({ page: String(page + 1) })} className="btn-outline rounded-full px-4 py-2 text-sm font-semibold">
              Siguiente
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
