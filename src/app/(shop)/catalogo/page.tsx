import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PackageSearch } from 'lucide-react';
import { ProductCard } from '@/components/shop/ProductCard';
import { CatalogFilters } from '@/components/shop/CatalogFilters';
import { getCatalog, getFilterOptions } from '@/lib/catalog';
import { cn } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  category?: string;
  brand?: string;
  pet?: string;
  sort?: string;
  offers?: string;
  page?: string;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { categories, brands } = await getFilterOptions();
  const cat = categories.find((c) => c.slug === searchParams.category);
  const brand = brands.find((b) => b.slug === searchParams.brand);

  const parts = [cat?.name, brand?.name].filter(Boolean);
  const title = searchParams.q
    ? `Búsqueda: ${searchParams.q}`
    : parts.length
      ? `${parts.join(' · ')} en Mendoza`
      : 'Catálogo completo';

  return {
    title,
    description: `Comprá ${parts.join(' ') || 'alimento y accesorios para mascotas'} en Mendoza con envío en el día. Precios actualizados y stock real.`,
    // Las combinaciones de filtros no aportan nada al índice de Google.
    robots: searchParams.q || searchParams.page ? { index: false, follow: true } : undefined,
  };
}

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);

  const [{ products, total, totalPages }, filters] = await Promise.all([
    getCatalog({
      q: searchParams.q,
      category: searchParams.category,
      brand: searchParams.brand,
      pet: searchParams.pet,
      sort: searchParams.sort,
      onlyOffers: searchParams.offers === '1',
      page,
    }),
    getFilterOptions(),
  ]);

  const categoryOptions = filters.categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    count: c._count.products,
    parentId: c.parentId,
  }));
  const brandOptions = filters.brands.map((b) => ({ slug: b.slug, name: b.name, count: b._count.products }));

  const heading = searchParams.q
    ? `Resultados para “${searchParams.q}”`
    : filters.categories.find((c) => c.slug === searchParams.category)?.name ?? 'Catálogo completo';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <span className="h-px w-6 bg-accent/40" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Catálogo</span>
        </div>
        <h1 className="text-3xl font-extrabold text-navy md:text-4xl">{heading}</h1>
      </header>

      <Suspense fallback={<div className="h-10" />}>
        <CatalogFilters categories={categoryOptions} brands={brandOptions} total={total}>
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-line bg-white py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                <PackageSearch className="h-7 w-7 text-accent" />
              </div>
              <p className="text-lg font-semibold text-navy">No encontramos nada con esos filtros</p>
              <p className="mt-1 max-w-sm text-sm text-navy/55">
                Probá con otra búsqueda, o escribinos por WhatsApp y lo conseguimos.
              </p>
              <Link href="/catalogo" className="btn-primary mt-6 rounded-full px-6 py-2.5 text-sm font-semibold">
                Ver todo el catálogo
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 6} />
                ))}
              </div>

              {totalPages > 1 && <Pagination page={page} totalPages={totalPages} params={searchParams} />}
            </>
          )}
        </CatalogFilters>
      </Suspense>
    </div>
  );
}

function Pagination({ page, totalPages, params }: { page: number; totalPages: number; params: SearchParams }) {
  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') next.set(k, String(v));
    if (p > 1) next.set('page', String(p));
    const qs = next.toString();
    return `/catalogo${qs ? `?${qs}` : ''}`;
  };

  // Ventana de 5 alrededor de la actual, para no imprimir 12 botones.
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Paginación">
      {page > 1 && (
        <Link href={href(page - 1)} className="btn-outline rounded-full px-4 py-2 text-sm font-semibold" scroll>
          Anterior
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition tabular',
            p === page ? 'bg-accent text-white' : 'border border-line bg-white text-navy hover:border-accent/40',
          )}
        >
          {p}
        </Link>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className="btn-outline rounded-full px-4 py-2 text-sm font-semibold" scroll>
          Siguiente
        </Link>
      )}
    </nav>
  );
}

