'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ShoppingCart, Check } from 'lucide-react';
import type { ProductCard } from '@/lib/catalog';
import { formatPrice, priceRange, discountPercent, displayName, cn } from '@/lib/format';
import { useCart } from '@/components/cart/CartProvider';
import { flyToCart } from '@/components/cart/flyToCart';
import { isCatProduct } from '@/components/cart/flyIcons';

const AUTOPLAY_MS = 5500;
const SWIPE_MIN = 50;

/**
 * Carrusel de destacados, grande y a lo ancho.
 *
 * Va debajo de la presentación: si es lo primero que aparece, el visitante cae
 * en un producto suelto sin saber en qué sitio está.
 *
 * Cada slide es una composición, no una foto estirada: las fotos del catálogo
 * vienen sobre fondo blanco y a esta altura se verían vacías. La imagen ocupa
 * una mitad y la otra lleva marca, nombre, precio y los botones.
 */
export function FeaturedHero({ products }: { products: ProductCard[] }) {
  const slides = products.slice(0, 6);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);
  const { add } = useCart();

  const go = useCallback(
    (delta: number) => setIdx((i) => (i + delta + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, go, slides.length]);

  // Flechas del teclado, para que se pueda usar sin mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    const el = document.getElementById('destacados');
    el?.addEventListener('keydown', onKey as EventListener);
    return () => el?.removeEventListener('keydown', onKey as EventListener);
  }, [go]);

  if (slides.length === 0) return null;

  function handleAdd(e: React.MouseEvent<HTMLButtonElement>, p: ProductCard) {
    const variant = p.variants[0];
    if (!variant || p.stock <= 0) return;
    add({
      productId: p.id,
      variantId: variant.id,
      slug: p.slug,
      name: p.name,
      variantLabel: variant.label,
      unitPrice: variant.price,
      originalPrice: variant.originalPrice,
      image: p.images[0]?.url ?? null,
    });
    flyToCart(e.currentTarget, { isCat: isCatProduct(p.name, p.category.slug, p.petType) });
    setAdded(p.id);
    setTimeout(() => setAdded(null), 1600);
  }

  return (
    <section
      id="destacados"
      tabIndex={-1}
      aria-roledescription="carrusel"
      aria-label="Productos destacados"
      className="relative overflow-hidden border-b border-line outline-none"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, #EFEADD 0%, #F6F4EF 45%, #F9F7F2 100%)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        setPaused(false);
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > SWIPE_MIN) go(dx > 0 ? -1 : 1);
      }}
    >
      <div className="blob animate-blob" style={{ width: 460, height: 460, background: '#E8A87C', top: -180, left: -160, opacity: 0.3 }} />
      <div className="blob animate-blob-slow" style={{ width: 420, height: 420, background: '#1B3C59', bottom: -200, right: -140, opacity: 0.1 }} />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-10 lg:px-16">
        <header className="pt-12 text-center md:pt-14 md:text-left">
          <div className="mb-2 flex items-center justify-center gap-3 md:justify-start">
            <span className="h-px w-6 bg-accent/40" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">Destacados</span>
          </div>
          <h2 className="text-3xl font-extrabold text-navy md:text-4xl">Lo que elegimos para vos</h2>
        </header>

        <div className="relative grid min-h-[380px] lg:min-h-[480px]">
          {slides.map((p, i) => {
            const range = priceRange(p.variants);
            const off = range.originalPrice ? discountPercent(range.min, range.originalPrice) : 0;
            const active = i === idx;

            return (
              <article
                key={p.id}
                aria-hidden={!active}
                className={cn(
                  // Todos los slides comparten la celda: el alto lo fija el más alto.
                  'col-start-1 row-start-1 grid items-center gap-6 py-8 transition-opacity duration-700 md:grid-cols-2 md:gap-10 md:py-10 lg:py-14',
                  active ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
              >
                {/* Imagen */}
                <Link
                  href={`/producto/${p.slug}`}
                  tabIndex={active ? 0 : -1}
                  className="group relative order-1 mx-auto aspect-square w-full max-w-[210px] justify-self-center overflow-hidden rounded-[2rem] bg-white sm:max-w-[300px] md:justify-self-end lg:max-w-[420px]"
                  style={{
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,.8), 0 2px 8px rgba(27,60,89,.06), 0 40px 80px -40px rgba(27,60,89,.35)',
                  }}
                >
                  {p.images[0] ? (
                    <Image
                      src={p.images[0].url}
                      alt={p.images[0].alt ?? displayName(p.name)}
                      fill
                      sizes="(max-width: 768px) 70vw, 440px"
                      priority={i === 0}
                      className="object-contain p-6 transition-transform duration-700 group-hover:scale-[1.04] lg:p-10"
                    />
                  ) : (
                    <div className="h-full w-full bg-bg-2" />
                  )}

                  {off > 0 && (
                    <span className="absolute left-5 top-5 rounded-full bg-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-white shadow-[0_8px_24px_-6px_rgba(224,122,60,.7)]">
                      −{off}%
                    </span>
                  )}
                </Link>

                {/* Texto */}
                <div className="order-2 min-w-0 text-center md:text-left">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">
                    {p.brand?.name ?? p.category.name}
                  </p>

                  <h2 className="text-3xl font-extrabold leading-[1.05] text-navy sm:text-4xl lg:text-5xl">
                    <Link href={`/producto/${p.slug}`} tabIndex={active ? 0 : -1} className="transition-colors hover:text-accent">
                      {displayName(p.name)}
                    </Link>
                  </h2>

                  <div className="mt-6 flex items-end justify-center gap-3 md:justify-start">
                    {range.originalPrice && (
                      <span className="pb-1 text-lg text-navy/40 line-through tabular">
                        {formatPrice(range.originalPrice)}
                      </span>
                    )}
                    <span className="text-4xl font-extrabold text-navy tabular lg:text-5xl">
                      {range.hasRange && <span className="text-lg font-semibold text-navy/55">Desde </span>}
                      {formatPrice(range.min)}
                    </span>
                  </div>

                  {p.variants.length > 1 && (
                    <p className="mt-2 text-sm text-navy/55">
                      {p.variants.length} presentaciones · {p.variants.map((v) => v.label).join(' · ')}
                    </p>
                  )}

                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                    <Link
                      href={`/producto/${p.slug}`}
                      tabIndex={active ? 0 : -1}
                      className="btn-primary btn-shine rounded-full px-8 py-4 text-base font-semibold"
                    >
                      Ver producto
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleAdd(e, p)}
                      disabled={p.stock <= 0}
                      tabIndex={active ? 0 : -1}
                      className="btn-outline flex items-center gap-2 rounded-full px-6 py-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {added === p.id ? <Check className="h-5 w-5 text-green-600" /> : <ShoppingCart className="h-5 w-5" />}
                      {p.stock <= 0 ? 'Sin stock' : added === p.id ? 'Agregado' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Flechas */}
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Destacado anterior"
                className="absolute left-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white/90 text-navy shadow-[0_6px_20px_-8px_rgba(27,60,89,.4)] backdrop-blur transition hover:border-accent/50 hover:text-accent lg:h-14 lg:w-14"
              >
                <ChevronLeft className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Destacado siguiente"
                className="absolute right-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white/90 text-navy shadow-[0_6px_20px_-8px_rgba(27,60,89,.4)] backdrop-blur transition hover:border-accent/50 hover:text-accent lg:h-14 lg:w-14"
              >
                <ChevronRight className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="flex justify-center gap-2 pb-10">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Ir al destacado ${i + 1} de ${slides.length}`}
                aria-current={i === idx}
                className="flex h-10 items-center px-2"
              >
                <span
                  className={cn(
                    'block h-2.5 rounded-full transition-all',
                    i === idx ? 'w-8 bg-accent' : 'w-2.5 bg-navy/20 hover:bg-navy/40',
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
