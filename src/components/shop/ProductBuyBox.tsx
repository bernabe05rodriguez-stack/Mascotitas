'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Minus, Plus, Check, ShoppingCart } from 'lucide-react';
import { formatPrice, discountPercent, displayName, cn } from '@/lib/format';
import { useCart } from '@/components/cart/CartProvider';
import { flyToCart } from '@/components/cart/flyToCart';
import { isCatProduct } from '@/components/cart/flyIcons';
import type { ShopSettings } from '@/lib/settings';

interface ProductData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  stock: number;
  petType: string | null;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string };
  variants: { id: string; label: string; price: number; originalPrice: number | null }[];
  images: { url: string; alt: string | null }[];
}

export function ProductBuyBox({ product, settings }: { product: ProductData; settings: ShopSettings }) {
  const [variantIdx, setVariantIdx] = useState(0);
  const [imageIdx, setImageIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { add, open } = useCart();

  const variant = product.variants[variantIdx];
  const inStock = product.stock > 0;
  const off = variant?.originalPrice ? discountPercent(variant.price, variant.originalPrice) : 0;
  // Con una sola presentación no hay nada que elegir: se muestra como dato, no
  // como un botón que no se puede deseleccionar.
  const showVariantPicker = product.variants.length > 1;
  const singleLabel = !showVariantPicker && variant?.label !== 'Unidad' ? variant?.label : null;

  function handleAdd(e: React.MouseEvent<HTMLButtonElement>) {
    if (!variant || !inStock) return;
    add(
      {
        productId: product.id,
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        variantLabel: variant.label,
        unitPrice: variant.price,
        originalPrice: variant.originalPrice,
        image: product.images[0]?.url ?? null,
      },
      qty,
    );
    flyToCart(e.currentTarget, { isCat: isCatProduct(product.name, product.category.slug, product.petType) });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  const waMessage = encodeURIComponent(
    `¡Hola Mascotitas! 🐾 Quería consultar por *${displayName(product.name)}*${
      variant && variant.label !== 'Unidad' ? ` (${variant.label})` : ''
    }.`,
  );

  return (
    <>
      {/* Galería */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-white">
          {product.images[imageIdx] ? (
            <Image
              src={product.images[imageIdx].url}
              alt={product.images[imageIdx].alt ?? displayName(product.name)}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 45vw"
              className="object-contain p-6"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-navy/30">Sin foto</div>
          )}

          {off > 0 && (
            <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-[0_4px_12px_-4px_rgba(224,122,60,.6)]">
              -{off}% OFF
            </span>
          )}
        </div>

        {product.images.length > 1 && (
          <div className="mt-3 flex gap-2">
            {product.images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setImageIdx(i)}
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={i === imageIdx}
                className={cn(
                  'relative h-20 w-20 overflow-hidden rounded-xl border bg-white transition',
                  i === imageIdx ? 'border-accent ring-2 ring-accent/20' : 'border-line hover:border-accent/40',
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-contain p-1" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compra */}
      <div>
        {product.brand && (
          <Link
            href={`/catalogo?brand=${product.brand.slug}`}
            className="text-xs font-bold uppercase tracking-[0.16em] text-accent transition hover:underline"
          >
            {product.brand.name}
          </Link>
        )}

        <h1 className="mt-2 text-3xl font-extrabold leading-tight text-navy md:text-4xl">{displayName(product.name)}</h1>

        <div className="mt-3 flex items-center gap-2">
          {inStock ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
              {product.stock === 1 ? 'Última unidad' : 'En stock'}
            </span>
          ) : (
            <span className="rounded-full bg-bg-2 px-3 py-1 text-xs font-semibold text-navy/50">Sin stock</span>
          )}
        </div>

        <div className="mt-6">
          {variant?.originalPrice && (
            <div className="text-lg text-navy/40 line-through tabular">{formatPrice(variant.originalPrice)}</div>
          )}
          <div className="text-4xl font-extrabold text-navy tabular">
            {variant ? formatPrice(variant.price) : '—'}
          </div>
        </div>

        {singleLabel && (
          <p className="mt-4 text-sm text-navy/60">
            Presentación: <strong className="font-semibold text-navy">{singleLabel}</strong>
          </p>
        )}

        {showVariantPicker && (
          <fieldset className="mt-6">
            <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-navy/55">
              Presentación
            </legend>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantIdx(i)}
                  aria-pressed={i === variantIdx}
                  className={cn(
                    'rounded-xl border px-4 py-2.5 text-sm font-semibold transition',
                    i === variantIdx
                      ? 'border-accent bg-accent/10 text-accent-dark'
                      : 'border-line bg-white text-navy/70 hover:border-accent/40',
                  )}
                >
                  <span className="block">{v.label}</span>
                  <span className="block text-xs font-medium text-navy/50 tabular">{formatPrice(v.price)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full bg-bg-cream">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-navy transition hover:bg-white"
              aria-label="Quitar uno"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-bold text-navy tabular">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-navy transition hover:bg-white"
              aria-label="Agregar uno"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!inStock}
            className="btn-primary btn-shine flex min-w-[200px] flex-1 items-center justify-center gap-2 rounded-full px-8 py-3.5 font-semibold"
          >
            {added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            {added ? 'Agregado' : inStock ? 'Agregar al carrito' : 'Sin stock'}
          </button>
        </div>

        {added && (
          <button
            type="button"
            onClick={open}
            className="mt-3 text-sm font-semibold text-accent transition hover:underline"
          >
            Ver mi pedido →
          </button>
        )}

        <a
          href={`https://wa.me/${settings.whatsapp}?text=${waMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-whatsapp/30 bg-whatsapp/5 py-3 text-sm font-semibold text-green-700 transition hover:bg-whatsapp/10"
        >
          Consultar por WhatsApp
        </a>

        {product.description && (
          <div className="mt-8 border-t border-line pt-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-navy/55">Descripción</h2>
            <p className="leading-relaxed text-navy/75" style={{ textWrap: 'pretty' }}>
              {product.description}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
