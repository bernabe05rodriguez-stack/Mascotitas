'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { ProductCard } from '@/lib/catalog';
import { formatPrice, priceRange, displayName, cn } from '@/lib/format';

const AUTOPLAY_MS = 4500;

export function FeaturedCarousel({ products }: { products: ProductCard[] }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = products.slice(0, 6);

  const go = useCallback(
    (delta: number) => setIdx((i) => (i + delta + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, go, slides.length]);

  if (slides.length === 0) return null;

  const p = slides[idx];
  const range = priceRange(p.variants);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative rounded-3xl bg-white p-6 pt-8 shadow-panel md:p-7">
        <span className="absolute -top-3 left-6 z-10 flex items-center gap-1.5 rounded-full border border-accent/20 bg-bg-cream px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy shadow-[0_2px_8px_-2px_rgba(27,60,89,.12)]">
          <Sparkles className="h-3 w-3 text-accent" /> Destacados
        </span>

        <Link href={`/producto/${p.slug}`} className="flex items-center gap-5">
          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl bg-white md:h-40 md:w-40">
            {p.images[0] ? (
              <Image
                src={p.images[0].url}
                alt={p.images[0].alt ?? displayName(p.name)}
                fill
                sizes="160px"
                priority
                className="object-contain"
              />
            ) : (
              <div className="h-full w-full bg-bg-2" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-accent">
              {p.brand?.name ?? p.category.name}
            </div>
            <h3 className="line-clamp-2 text-lg font-bold leading-snug text-navy md:text-xl">{displayName(p.name)}</h3>
            <div className="mt-3">
              {range.originalPrice && (
                <div className="text-sm text-navy/40 line-through tabular">{formatPrice(range.originalPrice)}</div>
              )}
              <div className="text-2xl font-extrabold text-navy tabular">
                {range.hasRange && <span className="text-sm font-semibold text-navy/55">Desde </span>}
                {formatPrice(range.min)}
              </div>
            </div>
          </div>
        </Link>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Anterior"
              className="nav-icon-btn absolute -left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-navy"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Siguiente"
              className="nav-icon-btn absolute -right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-navy"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ir al destacado ${i + 1}`}
              aria-current={i === idx}
              className={cn(
                'h-2 rounded-full transition-all',
                i === idx ? 'w-6 bg-accent' : 'w-2 bg-navy/20 hover:bg-navy/40',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
