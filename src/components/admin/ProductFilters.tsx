'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/format';

interface CategoryOption {
  slug: string;
  name: string;
  parentId: string | null;
}

interface Props {
  categories: CategoryOption[];
  total: number;
}

const ESTADOS = [
  { value: '', label: 'Visibles' },
  { value: 'ocultos', label: 'Ocultos' },
  { value: 'todos', label: 'Todos' },
];

/**
 * Filtros de la tabla de productos.
 *
 * Se aplican solos: los desplegables y las casillas al instante, el buscador
 * con una pausa de 350 ms para no disparar una consulta por cada tecla. Antes
 * había que apretar "Filtrar", que es un paso de más en la pantalla donde se
 * trabaja todo el día.
 */
export function ProductFilters({ categories, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    estado: params.get('estado') ?? '',
    stock: params.get('stock') ?? '',
    sinFoto: params.get('sinFoto') ?? '',
  };

  const [term, setTerm] = useState(current.q);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  // Marca los cambios nacidos acá, para no pisar lo que el usuario está
  // tecleando cuando llega la nueva URL.
  const typing = useRef(false);

  function apply(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // Cambiar un filtro tiene que volver a la primera página: si no, se filtra
    // estando en la página 4 y la tabla aparece vacía.
    next.delete('page');
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => {
    if (!typing.current) setTerm(current.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.q]);

  function onType(value: string) {
    setTerm(value);
    typing.current = true;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      typing.current = false;
      apply({ q: value.trim() });
    }, 350);
  }

  const activos =
    (current.category ? 1 : 0) +
    (current.estado ? 1 : 0) +
    (current.stock ? 1 : 0) +
    (current.sinFoto ? 1 : 0) +
    (current.q ? 1 : 0);

  const tops = categories.filter((c) => !c.parentId);
  const childrenOf = (slug: string) => categories.filter((c) => c.parentId === slug);

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          {pending ? (
            <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-accent" />
          ) : (
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
          )}
          <input
            value={term}
            onChange={(e) => onType(e.target.value)}
            placeholder="Buscar por nombre, marca, categoría o código"
            aria-label="Buscar productos"
            className="w-full rounded-full border border-line py-2 pl-10 pr-9 text-sm text-navy focus:border-accent focus:outline-none"
          />
          {term && (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                typing.current = false;
                clearTimeout(debounce.current);
                apply({ q: '' });
              }}
              aria-label="Borrar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/35 transition hover:text-navy"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={current.category}
          onChange={(e) => apply({ category: e.target.value })}
          aria-label="Filtrar por categoría"
          className="rounded-full border border-line px-4 py-2 text-sm text-navy focus:border-accent focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {tops.map((c) => (
            <optgroup key={c.slug} label={c.name}>
              <option value={c.slug}>{c.name} (todo)</option>
              {childrenOf(c.slug).map((child) => (
                <option key={child.slug} value={child.slug}>
                  {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          value={current.estado}
          onChange={(e) => apply({ estado: e.target.value })}
          aria-label="Filtrar por estado"
          className="rounded-full border border-line px-4 py-2 text-sm text-navy focus:border-accent focus:outline-none"
        >
          {ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>

        <Toggle label="Sin stock" active={current.stock === '0'} onClick={() => apply({ stock: current.stock ? '' : '0' })} />
        <Toggle label="Sin foto" active={current.sinFoto === '1'} onClick={() => apply({ sinFoto: current.sinFoto ? '' : '1' })} />

        {activos > 0 && (
          <button
            type="button"
            onClick={() => {
              setTerm('');
              typing.current = false;
              clearTimeout(debounce.current);
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy/50 transition hover:bg-bg-2 hover:text-navy"
          >
            <X className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
      </div>

      <p className={cn('mt-3 text-xs transition-opacity', pending ? 'text-accent' : 'text-navy/50')}>
        {pending ? 'Buscando…' : (
          <>
            <span className="font-semibold tabular">{total}</span> {total === 1 ? 'producto' : 'productos'}
            {activos > 0 && ' con estos filtros'}
          </>
        )}
      </p>
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-[42px] items-center rounded-full border px-4 py-2 text-sm font-medium transition',
        active
          ? 'border-accent bg-accent/10 text-accent-dark'
          : 'border-line text-navy/70 hover:border-accent/40 hover:text-navy',
      )}
    >
      {label}
    </button>
  );
}
