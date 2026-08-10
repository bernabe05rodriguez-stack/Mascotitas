'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Star, Eye, EyeOff, Pencil, Check, Loader2, ImageOff } from 'lucide-react';
import { quickUpdateAction, toggleFeaturedAction, toggleActiveAction } from '@/app/admin/actions';
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

  return (
    <tr className={cn(!product.active && 'bg-bg-2/40 opacity-60')}>
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
            <p className="text-xs text-navy/45">
              {product.brand?.name ?? 'Sin marca'}
              {product.legacyId && <span className="ml-2 tabular">#{product.legacyId}</span>}
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

          <IconButton
            label={product.featured ? 'Quitar de destacados' : 'Marcar como destacado'}
            active={product.featured}
            onClick={() => startTransition(() => void toggleFeaturedAction(product.id))}
          >
            <Star className={cn('h-4 w-4', product.featured && 'fill-current')} />
          </IconButton>

          <IconButton
            label={product.active ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
            onClick={() => startTransition(() => void toggleActiveAction(product.id))}
          >
            {product.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </IconButton>

          <Link
            href={`/admin/productos/${product.id}`}
            aria-label="Editar producto"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy/50 transition hover:bg-bg-2 hover:text-navy"
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
        'flex h-8 w-8 items-center justify-center rounded-lg transition',
        active ? 'text-gold hover:bg-gold/10' : 'text-navy/40 hover:bg-bg-2 hover:text-navy',
      )}
    >
      {children}
    </button>
  );
}
