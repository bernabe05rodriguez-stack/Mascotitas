'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { SlidersHorizontal, X, Check } from 'lucide-react';
import { cn } from '@/lib/format';

interface Option {
  slug: string;
  name: string;
  count: number;
  parentId?: string | null;
  id?: string;
}

interface Props {
  categories: Option[];
  brands: Option[];
  total: number;
  /** La grilla de productos. El componente es dueño del layout de dos columnas
   *  para que el toolbar quede arriba y no como tercer hijo de la grilla. */
  children: React.ReactNode;
}

const SORTS = [
  { value: '', label: 'Recomendados' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
  { value: 'nombre', label: 'Nombre (A-Z)' },
  { value: 'nuevos', label: 'Más nuevos' },
];

const PETS = [
  { value: '', label: 'Todas' },
  { value: 'perro', label: 'Perros' },
  { value: 'gato', label: 'Gatos' },
];

export function CatalogFilters({ categories, brands, total, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openMobile, setOpenMobile] = useState(false);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page'); // cambiar un filtro tiene que volver a la página 1
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const current = {
    category: params.get('category') ?? '',
    brand: params.get('brand') ?? '',
    pet: params.get('pet') ?? '',
    sort: params.get('sort') ?? '',
    offers: params.get('offers') === '1',
    q: params.get('q') ?? '',
  };

  const activeCount =
    (current.category ? 1 : 0) + (current.brand ? 1 : 0) + (current.pet ? 1 : 0) + (current.offers ? 1 : 0);

  const tops = categories.filter((c) => !c.parentId);
  const childrenOf = (id?: string) => categories.filter((c) => c.parentId === id);
  const selectedTop = tops.find(
    (t) => t.slug === current.category || childrenOf(t.id).some((c) => c.slug === current.category),
  );

  function clearAll() {
    const next = new URLSearchParams();
    if (current.q) next.set('q', current.q);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const panel = (
    <div className="space-y-6">
      <Group title="Mascota">
        <div className="flex flex-wrap gap-2">
          {PETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setParam('pet', p.value)}
              className={cn('chip', current.pet === p.value ? 'chip-active' : 'chip-idle')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Categoría">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setParam('category', '')}
            className={cn('chip', !current.category ? 'chip-active' : 'chip-idle')}
          >
            Todas
          </button>
          {tops.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setParam('category', c.slug)}
              className={cn('chip', current.category === c.slug ? 'chip-active' : 'chip-idle')}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Subcategorías: sólo cuando la categoría elegida tiene hijas */}
        {selectedTop && childrenOf(selectedTop.id).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-l-2 border-line pl-3">
            {childrenOf(selectedTop.id).map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setParam('category', current.category === c.slug ? selectedTop.slug : c.slug)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  current.category === c.slug ? 'bg-accent/15 text-accent-dark' : 'text-navy/60 hover:bg-bg-2',
                )}
              >
                {c.name} <span className="text-navy/35 tabular">{c.count}</span>
              </button>
            ))}
          </div>
        )}
      </Group>

      <Group title="Marca">
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {brands.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => setParam('brand', current.brand === b.slug ? '' : b.slug)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm transition',
                current.brand === b.slug ? 'bg-accent/10 font-semibold text-accent-dark' : 'text-navy/70 hover:bg-bg-2',
              )}
            >
              <span className="flex items-center gap-2 truncate">
                {current.brand === b.slug && <Check className="h-3.5 w-3.5 shrink-0" />}
                {b.name}
              </span>
              <span className="shrink-0 text-xs text-navy/35 tabular">{b.count}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Ofertas">
        <button
          type="button"
          onClick={() => setParam('offers', current.offers ? '' : '1')}
          className={cn('chip', current.offers ? 'chip-active' : 'chip-idle')}
        >
          Solo con descuento
        </button>
      </Group>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-line py-2 text-sm font-semibold text-navy/60 transition hover:border-accent/40 hover:text-navy"
        >
          <X className="h-3.5 w-3.5" /> Limpiar filtros
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Barra superior: resultados + orden + botón de filtros en mobile */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-navy/60">
          <span className="font-bold text-navy tabular">{total}</span> {total === 1 ? 'producto' : 'productos'}
        </p>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="sort">
            Ordenar por
          </label>
          <select
            id="sort"
            value={current.sort}
            onChange={(e) => setParam('sort', e.target.value)}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-navy focus:border-accent focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            className="btn-outline flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Desktop: columna fija. En mobile el panel vive en el drawer. */}
        <aside className="hidden lg:block">{panel}</aside>
        <div className="min-w-0">{children}</div>
      </div>

      {/* Mobile: panel deslizante */}
      {openMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setOpenMobile(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy">Filtros</h2>
              <button
                type="button"
                onClick={() => setOpenMobile(false)}
                className="nav-icon-btn flex h-9 w-9 items-center justify-center rounded-full text-navy"
                aria-label="Cerrar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {panel}
            <button
              type="button"
              onClick={() => setOpenMobile(false)}
              className="btn-primary mt-6 w-full rounded-full py-3 font-semibold"
            >
              Ver {total} productos
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-navy/55">{title}</h3>
      {children}
    </div>
  );
}
