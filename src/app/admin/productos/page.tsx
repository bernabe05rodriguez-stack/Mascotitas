import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { prisma } from '@/lib/db';
import { ProductTable } from '@/components/admin/ProductTable';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

interface SearchParams {
  q?: string;
  category?: string;
  stock?: string;
  sinFoto?: string;
  inactivos?: string;
  page?: string;
}

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);

  const where: Prisma.ProductWhereInput = {};
  if (searchParams.inactivos !== '1') where.active = true;
  if (searchParams.q) {
    where.OR = [
      { name: { contains: searchParams.q, mode: 'insensitive' } },
      { legacyId: { contains: searchParams.q } },
      { brand: { name: { contains: searchParams.q, mode: 'insensitive' } } },
    ];
  }
  if (searchParams.category) where.category = { slug: searchParams.category };
  if (searchParams.stock === '0') where.stock = 0;
  if (searchParams.sinFoto === '1') where.images = { none: {} };

  const [products, total, categories] = await Promise.all([
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
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const buildHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...searchParams, ...patch })) if (v) next.set(k, String(v));
    return `/admin/productos?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-navy">Productos</h1>
          <p className="text-sm text-navy/55">
            <span className="font-semibold tabular">{total}</span> resultados · editá precio y stock directo en la tabla
          </p>
        </div>
        <Link href="/admin/productos/nuevo" className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Nuevo producto
        </Link>
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Buscar por nombre, marca o código"
            className="w-full rounded-full border border-line py-2 pl-10 pr-4 text-sm text-navy focus:border-accent focus:outline-none"
          />
        </div>

        <select
          name="category"
          defaultValue={searchParams.category ?? ''}
          className="rounded-full border border-line px-4 py-2 text-sm text-navy focus:border-accent focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-navy">
          <input type="checkbox" name="stock" value="0" defaultChecked={searchParams.stock === '0'} className="accent-accent" />
          Sin stock
        </label>

        <label className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-navy">
          <input type="checkbox" name="sinFoto" value="1" defaultChecked={searchParams.sinFoto === '1'} className="accent-accent" />
          Sin foto
        </label>

        <label className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-navy">
          <input type="checkbox" name="inactivos" value="1" defaultChecked={searchParams.inactivos === '1'} className="accent-accent" />
          Ver ocultos
        </label>

        <button type="submit" className="btn-outline rounded-full px-5 py-2 text-sm font-semibold">
          Filtrar
        </button>
      </form>

      <ProductTable products={products} />

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
          {page > 1 && (
            <Link href={buildHref({ page: String(page - 1) })} className="btn-outline rounded-full px-4 py-2 text-sm font-semibold">
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
