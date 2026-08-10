'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import type { ProductCard as ProductCardData } from '@/lib/catalog';
import { formatPrice, discountPercent, displayName, cn } from '@/lib/format';
import { useCart } from '@/components/cart/CartProvider';
import { flyToCart } from '@/components/cart/flyToCart';
import { isCatProduct } from '@/components/cart/flyIcons';

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const [variantIdx, setVariantIdx] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const { add } = useCart();

  const variant = product.variants[variantIdx] ?? product.variants[0];
  const image = product.images[0];
  const outOfStock = product.stock <= 0;
  const off = variant?.originalPrice ? discountPercent(variant.price, variant.originalPrice) : 0;
  // Una sola presentación "Unidad" no necesita selector: es ruido.
  const showVariants = product.variants.length > 1;

  function handleAdd(e: React.MouseEvent<HTMLButtonElement>) {
    if (!variant || outOfStock) return;
    add({
      productId: product.id,
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      variantLabel: variant.label,
      unitPrice: variant.price,
      originalPrice: variant.originalPrice,
      image: image?.url ?? null,
    });
    flyToCart(e.currentTarget, {
      isCat: isCatProduct(product.name, product.category.slug, product.petType),
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  }

  return (
    <article
      className={cn(
        'product-card group relative flex flex-col overflow-hidden rounded-2xl border',
        outOfStock && 'opacity-70',
      )}
    >
      {/* Fondo blanco a propósito: las fotos traen fondo blanco embebido y sobre
          cualquier otro color se ven como un recuadro pegado. */}
      <Link href={`/producto/${product.slug}`} className="relative block aspect-square overflow-hidden bg-white">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt ?? displayName(product.name)}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            className="object-contain p-3"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-navy/30">Sin foto</div>
        )}

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {off > 0 && (
            <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-[0_4px_12px_-4px_rgba(224,122,60,.6)]">
              -{off}%
            </span>
          )}
          {product.featured && off === 0 && (
            <span className="rounded-full bg-bg-cream px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-dark">
              Destacado
            </span>
          )}
        </div>

        {outOfStock && (
          <div className="absolute inset-x-0 bottom-0 bg-navy/80 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-white">
            Sin stock
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 md:p-4">
        {product.brand && (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">{product.brand.name}</span>
        )}

        <Link
          href={`/producto/${product.slug}`}
          className="line-clamp-2 text-sm font-bold leading-snug text-navy transition-colors hover:text-accent md:text-base"
        >
          {displayName(product.name)}
        </Link>

        {showVariants && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presentación">
            {product.variants.map((v, i) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantIdx(i)}
                aria-pressed={i === variantIdx}
                className={cn(
                  'rounded-lg border px-2 py-1 text-[11px] font-semibold transition',
                  i === variantIdx
                    ? 'border-accent bg-accent/10 text-accent-dark'
                    : 'border-line bg-white text-navy/70 hover:border-accent/40',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0">
            {variant?.originalPrice && (
              <div className="text-xs text-navy/40 line-through tabular">{formatPrice(variant.originalPrice)}</div>
            )}
            <div className="truncate text-lg font-bold text-navy tabular md:text-xl">
              {variant ? formatPrice(variant.price) : '—'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={outOfStock}
            aria-label={`Agregar ${displayName(product.name)} al carrito`}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition',
              outOfStock ? 'cursor-not-allowed bg-bg-2 text-navy/30' : 'btn-primary',
            )}
          >
            {justAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="animate-skeleton overflow-hidden rounded-2xl border border-line bg-white">
      <div className="aspect-square bg-bg-2" />
      <div className="space-y-2 p-4">
        <div className="h-2 w-1/3 rounded bg-bg-2" />
        <div className="h-3 w-full rounded bg-bg-2" />
        <div className="h-3 w-2/3 rounded bg-bg-2" />
        <div className="h-6 w-1/2 rounded bg-bg-2" />
      </div>
    </div>
  );
}
