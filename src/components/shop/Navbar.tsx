'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, ShoppingCart, X, Menu } from 'lucide-react';
import { useCart } from '@/components/cart/CartProvider';
import { cn } from '@/lib/format';

export function Navbar() {
  const { count, open, pulse } = useCart();
  const [mobileSearch, setMobileSearch] = useState(false);
  const [popping, setPopping] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPopping(true);
    const t = setTimeout(() => setPopping(false), 450);
    return () => clearTimeout(t);
  }, [pulse]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = term.trim();
    router.push(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo');
    setMobileSearch(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/95 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
        {!mobileSearch && (
          <Link href="/" className="shrink-0" aria-label="Mascotitas — inicio">
            <Image
              src="/logo.png"
              alt="Mascotitas"
              width={160}
              height={48}
              priority
              className="h-10 w-auto sm:h-12"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(27,60,89,.12))' }}
            />
          </Link>
        )}

        {/* Buscador desktop */}
        <form onSubmit={submitSearch} className="relative hidden flex-1 md:block">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40"
            aria-hidden
          />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            type="search"
            placeholder="Buscar alimento, marca o accesorio…"
            aria-label="Buscar productos"
            className="search-pill w-full rounded-full border border-line bg-white/80 py-2.5 pl-11 pr-4 text-sm text-navy placeholder:text-navy/40"
          />
        </form>

        {/* Buscador mobile expandido */}
        {mobileSearch && (
          <form onSubmit={submitSearch} className="flex flex-1 items-center gap-2 md:hidden">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40"
                aria-hidden
              />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                type="search"
                placeholder="Buscar…"
                aria-label="Buscar productos"
                className="search-pill w-full rounded-full border border-line bg-white/80 py-2.5 pl-11 pr-4 text-sm text-navy placeholder:text-navy/40"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileSearch(false)}
              className="nav-icon-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy"
              aria-label="Cerrar buscador"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        )}

        <div className={cn('ml-auto flex shrink-0 items-center gap-2', mobileSearch && 'hidden')}>
          <Link
            href="/catalogo"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-navy/80 transition hover:bg-bg-2 hover:text-navy sm:block"
          >
            Catálogo
          </Link>

          <button
            type="button"
            onClick={() => setMobileSearch(true)}
            className="nav-icon-btn flex h-11 w-11 items-center justify-center rounded-full text-navy md:hidden"
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            id="nav-cart"
            type="button"
            onClick={open}
            className="nav-cart-btn relative flex h-10 w-10 items-center justify-center rounded-full sm:h-11 sm:w-11"
            aria-label={`Abrir carrito${count ? ` (${count} productos)` : ''}`}
          >
            <ShoppingCart className="h-[18px] w-[18px] text-white" />
            {count > 0 && (
              <span
                className={cn(
                  'absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-navy px-1 text-[11px] font-bold text-white ring-2 ring-bg tabular',
                  popping && 'animate-cart-pop',
                )}
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
