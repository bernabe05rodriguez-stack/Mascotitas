'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Star, Eye, EyeOff, Pencil, Check, Loader2, ImageOff, Undo2 } from 'lucide-react';
import { quickUpdateAction } from '@/app/admin/actions';
import { formatPrice, displayName, cn } from '@/lib/format';

interface Variant {
  id: string;
  label: string;
  price: number;
  originalPrice: number | null;
}

interface Row {
  id: string;
  slug: string;
  name: string;
  stock: number;
  featured: boolean;
  active: boolean;
  legacyId: string | null;
  category: { name: string };
  brand: { name: string } | null;
  variants: Variant[];
  images: { url: string }[];
}

/**
 * La tabla que reemplaza a la planilla.
 *
 * La edición de precio y stock es inline y se guarda por fila: cargar la lista
 * de precios de una distribuidora no puede obligar a entrar y salir de 40
 * formularios.
 */
export function ProductTable({ products }: { products: Row[] }) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-navy/50">
        No hay productos con esos filtros.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-navy/50">
          <tr>
            <th className="px-3 py-3 font-semibold">Producto</th>
            <th className="px-3 py-3 font-semibold">Categoría</th>
            <th className="px-3 py-3 font-semibold">Presentaciones y precio</th>
            <th className="px-3 py-3 font-semibold">Stock</th>
            <th className="px-3 py-3 text-right font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {products.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductRow({ product }: { product: Row }) {
  // El estado de visible/destacado se lleva acá, no se relee del servidor: si
  // la lista se refrescara, la fila desaparecería (la tabla filtra por estado)
  // y el cambio parecería no haber pasado. Ver el comentario en actions.ts.
  const [active, setActive] = useState(product.active);
  const [featured, setFeatured] = useState(product.featured);
  const [ultimoCambio, setUltimoCambio] = useState<'visibilidad' | 'destacado' | null>(null);
  const [stock, setStock] = useState(product.stock);
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(product.variants.map((v) => [v.id, v.price])),
  );
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty =
    stock !== product.stock || product.variants.some((v) => prices[v.id] !== v.price);

  function save() {
    const fd = new FormData();
    fd.set('productId', product.id);
    fd.set('stock', String(stock));
    for (const v of product.variants) fd.set(`price_${v.id}`, String(prices[v.id]));

    startTransition(async () => {
      await quickUpdateAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  async function alternar(field: 'active' | 'featured') {
    // fetch y no server action: ver el comentario en la ruta de API.
    const res = await fetch(`/api/admin/products/${product.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { field: string; value: boolean };
  }

  function cambiarVisibilidad() {
    setActive((a) => !a); // optimista: el cambio se ve al instante
    setUltimoCambio('visibilidad');
    startTransition(async () => {
      const r = await alternar('active');
      if (r) setActive(r.value);
      else setActive(product.active); // volvió a fallar: se revierte
    });
  }

  function cambiarDestacado() {
    setFeatured((f) => !f);
    setUltimoCambio('destacado');
    startTransition(async () => {
      const r = await alternar('featured');
      if (r) setFeatured(r.value);
      else setFeatured(product.featured);
    });
  }

  return (
    <tr className={cn(!active && 'bg-bg-2/40 opacity-60')}>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
            {product.images[0] ? (
              <Image src={product.images[0].url} alt="" fill sizes="44px" className="object-contain p-0.5" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageOff className="h-4 w-4 text-navy/25" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/productos/${product.id}`}
              className="block max-w-[240px] truncate font-semibold text-navy hover:text-accent"
            >
              {displayName(product.name)}
            </Link>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-navy/45">
              {!active && (
                <span className="rounded-full bg-navy/10 px-2 py-0.5 font-semibold text-navy/60">Oculto</span>
              )}
              {product.brand?.name ?? 'Sin marca'}
              {product.legacyId && <span className="tabular">#{product.legacyId}</span>}
            </p>
          </div>
        </div>
      </td>

      <td className="px-3 py-3 text-navy/60">{product.category.name}</td>

      <td className="px-3 py-3">
        <div className="space-y-1">
          {product.variants.map((v) => (
            <div key={v.id} className="flex items-center gap-2">
              <span className="w-16 shrink-0 truncate text-xs font-semibold text-navy/55">{v.label}</span>
              <span className="text-xs text-navy/40">$</span>
              <input
                type="number"
                min={0}
                step={100}
                value={prices[v.id]}
                onChange={(e) => setPrices((prev) => ({ ...prev, [v.id]: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-24 rounded-lg border border-line px-2 py-1 text-right text-sm text-navy tabular focus:border-accent focus:outline-none"
                aria-label={`Precio de ${v.label}`}
              />
              {v.originalPrice && (
                <span className="text-xs text-navy/35 line-through tabular">{formatPrice(v.originalPrice)}</span>
              )}
            </div>
          ))}
        </div>
      </td>

      <td className="px-3 py-3">
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => setStock(Math.max(0, Number(e.target.value) || 0))}
          className={cn(
            'w-20 rounded-lg border px-2 py-1 text-right text-sm tabular focus:border-accent focus:outline-none',
            stock === 0 ? 'border-red-200 bg-red-50 text-red-600' : 'border-line text-navy',
          )}
          aria-label={`Stock de ${displayName(product.name)}`}
        />
      </td>

      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="btn-primary flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Guardar
            </button>
          )}
          {saved && !dirty && <span className="mr-1 text-xs font-semibold text-green-600">Guardado</span>}

          {/* El aviso con "Deshacer" es lo que faltaba: sin él, ocultar un
              producto se sentía como que el botón no hacía nada. */}
          {ultimoCambio && (
            <span className="mr-1 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-bg-2 py-1 pl-2.5 pr-1 text-xs font-medium text-navy/70">
              {ultimoCambio === 'visibilidad'
                ? active
                  ? 'Visible'
                  : 'Ocultado'
                : featured
                  ? 'Destacado'
                  : 'Sin destacar'}
              <button
                type="button"
                onClick={() => (ultimoCambio === 'visibilidad' ? cambiarVisibilidad() : cambiarDestacado())}
                className="flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-accent transition hover:bg-white"
              >
                <Undo2 className="h-3 w-3" /> Deshacer
              </button>
            </span>
          )}

          <IconButton
            label={featured ? 'Quitar de destacados' : 'Marcar como destacado'}
            active={featured}
            onClick={cambiarDestacado}
          >
            <Star className={cn('h-4 w-4', featured && 'fill-current')} />
          </IconButton>

          <IconButton
            label={active ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
            onClick={cambiarVisibilidad}
          >
            {active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </IconButton>

          <Link
            href={`/admin/productos/${product.id}`}
            aria-label="Editar producto"
            className="flex h-10 w-10 items-center justify-center rounded-lg sm:h-9 sm:w-9 text-navy/50 transition hover:bg-bg-2 hover:text-navy"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function IconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg sm:h-9 sm:w-9 transition',
        active ? 'text-gold hover:bg-gold/10' : 'text-navy/40 hover:bg-bg-2 hover:text-navy',
      )}
    >
      {children}
    </button>
  );
}
