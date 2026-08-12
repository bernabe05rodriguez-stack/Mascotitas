'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  Check,
  Loader2,
  X,
  Flame,
} from 'lucide-react';
import { createLocalOrderAction } from '@/app/admin/actions';
import { cn, formatPrice, displayName } from '@/lib/format';

export interface PosVariant {
  id: string;
  label: string;
  price: number;
  originalPrice: number | null;
  /** null = hereda el stock del producto. */
  stock: number | null;
}

export interface PosProduct {
  id: string;
  name: string;
  stock: number;
  /** Unidades vendidas históricas (pedidos no cancelados). */
  sold: number;
  brand: string | null;
  categoryName: string;
  categorySlug: string;
  parentSlug: string | null;
  image: string | null;
  variants: PosVariant[];
}

export interface PosCategory {
  slug: string;
  name: string;
  parentSlug: string | null;
}

interface CartLine {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  price: number;
  quantity: number;
  image: string | null;
}

type Orden = 'vendidos' | 'nombre' | 'precio-asc' | 'precio-desc' | 'stock';

const ORDENES: { value: Orden; label: string }[] = [
  { value: 'vendidos', label: 'Más vendidos' },
  { value: 'nombre', label: 'Nombre A-Z' },
  { value: 'precio-asc', label: 'Precio: menor' },
  { value: 'precio-desc', label: 'Precio: mayor' },
  { value: 'stock', label: 'Más stock' },
];

/** Sin tildes y en minúscula: buscar "acana" tiene que encontrar "Acaná". */
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function minPrice(p: PosProduct) {
  if (p.variants.length === 0) return Infinity;
  return Math.min(...p.variants.map((v) => v.price));
}

/** El stock que manda para una variante: el propio si lo define, si no el del producto. */
function variantStock(product: PosProduct, variant: PosVariant) {
  return variant.stock ?? product.stock;
}

export function PosClient({
  products,
  categories,
}: {
  products: PosProduct[];
  categories: PosCategory[];
}) {
  const router = useRouter();

  // ------------------------------------------------------------- filtros
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [orden, setOrden] = useState<Orden>('vendidos');
  const [soloStock, setSoloStock] = useState(false);

  // ------------------------------------------------------------- carrito
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Lo que se tecleó ANTES de que el navegador terminara de cargar el JS queda
  // en el input pero no en el estado: la pantalla mostraba el catálogo entero
  // con el texto escrito en el buscador. En el mostrador se abre Venta y se
  // escribe al toque, así que pasa siempre. Al montar, se recupera.
  useEffect(() => {
    const escrito = inputRef.current?.value ?? '';
    if (escrito) setQuery(escrito);
  }, []);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.brand) set.add(p.brand);
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [products]);

  // Texto en el que busca el buscador, calculado una sola vez por producto.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      map.set(
        p.id,
        norm([p.name, p.brand ?? '', p.categoryName, ...p.variants.map((v) => v.label)].join(' ')),
      );
    }
    return map;
  }, [products]);

  const visible = useMemo(() => {
    const terms = norm(query).split(/\s+/).filter(Boolean);

    const list = products.filter((p) => {
      if (soloStock && p.stock <= 0) return false;
      if (brand && p.brand !== brand) return false;
      // Elegir una categoría madre tiene que traer también sus subcategorías.
      if (category && p.categorySlug !== category && p.parentSlug !== category) return false;
      if (terms.length) {
        const hay = haystacks.get(p.id) ?? '';
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    const byName = (a: PosProduct, b: PosProduct) => a.name.localeCompare(b.name, 'es');
    const sorted = [...list];
    switch (orden) {
      case 'nombre':
        sorted.sort(byName);
        break;
      case 'precio-asc':
        sorted.sort((a, b) => minPrice(a) - minPrice(b) || byName(a, b));
        break;
      case 'precio-desc':
        sorted.sort((a, b) => minPrice(b) - minPrice(a) || byName(a, b));
        break;
      case 'stock':
        sorted.sort((a, b) => b.stock - a.stock || byName(a, b));
        break;
      default:
        sorted.sort((a, b) => b.sold - a.sold || byName(a, b));
    }
    return sorted;
  }, [products, haystacks, query, category, brand, orden, soloStock]);

  // Posición en el ranking global (no en la lista filtrada): la medalla del
  // producto no puede cambiar según lo que esté filtrado.
  const rankById = useMemo(() => {
    const map = new Map<string, number>();
    products
      .filter((p) => p.sold > 0)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 3)
      .forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [products]);

  const filtrosActivos =
    (query ? 1 : 0) + (category ? 1 : 0) + (brand ? 1 : 0) + (soloStock ? 1 : 0);

  function limpiar() {
    setQuery('');
    setCategory('');
    setBrand('');
    setSoloStock(false);
    inputRef.current?.focus();
  }

  function addToCart(product: PosProduct, variant: PosVariant) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.variantId === variant.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(next[idx].quantity + 1, 99) };
        return next;
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          variantLabel: variant.label,
          price: variant.price,
          quantity: 1,
          image: product.image,
        },
      ];
    });
  }

  function setQuantity(variantId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((l) => l.variantId !== variantId));
    } else {
      setCart((prev) =>
        prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(qty, 99) } : l)),
      );
    }
  }

  const subtotal = cart.reduce((n, l) => n + l.price * l.quantity, 0);
  const totalItems = cart.reduce((n, l) => n + l.quantity, 0);
  const enCarrito = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of cart) map.set(l.variantId, l.quantity);
    return map;
  }, [cart]);

  async function confirm() {
    if (cart.length === 0) return;
    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createLocalOrderAction({
        customerName: customerName.trim() || undefined,
        note: note.trim() || undefined,
        items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      });

      if (result.ok) {
        setSuccess(result.message ?? 'Pedido registrado');
        setCart([]);
        setCustomerName('');
        setNote('');
        // Sin esto el stock y el ranking de la grilla quedan como estaban antes
        // de la venta que se acaba de cargar.
        router.refresh();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error ?? 'Error desconocido');
      }
    } catch {
      setError('Error de conexión');
    }

    setSending(false);
  }

  const tops = categories.filter((c) => !c.parentSlug);
  const childrenOf = (slug: string) => categories.filter((c) => c.parentSlug === slug);

  return (
    // El padding de abajo deja lugar a la barra fija del celular; sin él tapa
    // las últimas tarjetas de la grilla.
    <div className="space-y-6 pb-24 lg:pb-0">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Punto de Venta</h1>
        <p className="text-sm text-navy/55">Cargá pedidos desde el local</p>
      </div>

      {/* minmax(0,…) en las dos columnas: sin eso, una línea del ticket que no
          entra (foto + nombre + cantidad + precio) estira la columna y la
          pantalla entera queda con scroll horizontal en el celular. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Columna izquierda: filtros + catálogo */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, marca, categoría o presentación…"
                  aria-label="Buscar productos"
                  className="w-full rounded-full border border-line py-2 pl-10 pr-9 text-sm text-navy outline-none focus:border-accent"
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Borrar búsqueda"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/35 transition hover:text-navy"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filtrar por categoría"
                className="rounded-full border border-line px-4 py-2 text-sm text-navy outline-none focus:border-accent"
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

              {brands.length > 0 && (
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  aria-label="Filtrar por marca"
                  className="rounded-full border border-line px-4 py-2 text-sm text-navy outline-none focus:border-accent"
                >
                  <option value="">Todas las marcas</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
                aria-label="Ordenar productos"
                className="rounded-full border border-line px-4 py-2 text-sm text-navy outline-none focus:border-accent"
              >
                {ORDENES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setSoloStock((v) => !v)}
                aria-pressed={soloStock}
                className={cn(
                  'flex min-h-[38px] items-center rounded-full border px-4 py-2 text-sm font-medium transition',
                  soloStock
                    ? 'border-accent bg-accent/10 text-accent-dark'
                    : 'border-line text-navy/70 hover:border-accent/40 hover:text-navy',
                )}
              >
                Con stock
              </button>

              {filtrosActivos > 0 && (
                <button
                  type="button"
                  onClick={limpiar}
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy/50 transition hover:bg-bg-2 hover:text-navy"
                >
                  <X className="h-3.5 w-3.5" /> Limpiar
                </button>
              )}
            </div>

            <p className="mt-3 text-xs text-navy/50">
              <span className="font-semibold tabular-nums">{visible.length}</span>{' '}
              {visible.length === 1 ? 'producto' : 'productos'}
              {filtrosActivos > 0 && ` de ${products.length}`}
            </p>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-navy/50">
              Ningún producto con estos filtros.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  rank={rankById.get(product.id)}
                  enCarrito={enCarrito}
                  onAdd={addToCart}
                />
              ))}
            </div>
          )}
        </div>

        {/* Columna derecha: carrito / ticket */}
        <div
          ref={ticketRef}
          className="scroll-mt-24 rounded-xl border border-line bg-white lg:sticky lg:top-24 lg:self-start"
        >
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-accent" />
              <h2 className="font-serif text-lg font-bold text-navy">
                Pedido {totalItems > 0 && <span className="text-accent">({totalItems})</span>}
              </h2>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
            {cart.length === 0 ? (
              <p className="py-10 text-center text-sm text-navy/35">
                Tocá una presentación para agregarla
              </p>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => (
                  // Dos renglones y no uno: en la columna de 380px, nombre +
                  // presentación + los tres botones + el total no entran, y el
                  // nombre del producto quedaba cortado en tres letras.
                  <div key={line.variantId} className="flex gap-3">
                    {line.image && (
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-white">
                        <Image src={line.image} alt="" fill sizes="40px" className="object-contain" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-navy">
                          {displayName(line.productName)}
                        </p>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-navy">
                          {formatPrice(line.price * line.quantity)}
                        </p>
                      </div>
                      <p className="text-xs text-navy/50">
                        {line.variantLabel} — {formatPrice(line.price)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <button
                          onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                          aria-label="Quitar uno"
                          className="grid h-7 w-7 place-items-center rounded-full border border-line text-navy/60 transition hover:bg-bg"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums text-navy">
                          {line.quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                          aria-label="Agregar uno"
                          className="grid h-7 w-7 place-items-center rounded-full border border-line text-navy/60 transition hover:bg-bg"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setQuantity(line.variantId, 0)}
                          aria-label="Sacar del pedido"
                          className="ml-auto grid h-7 w-7 place-items-center rounded-full text-red-400 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="space-y-3 border-t border-line px-5 py-4">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente (opcional)"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nota (opcional)"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-medium text-navy/60">Total</span>
                <span className="text-xl font-bold tabular-nums text-navy">
                  {formatPrice(subtotal)}
                </span>
              </div>
              <button
                onClick={confirm}
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 font-bold text-white shadow-md transition hover:bg-accent-dark disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                Confirmar pedido
              </button>
            </div>
          )}

          {success && (
            <div className="mx-5 mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              ✓ {success}
            </div>
          )}
          {error && (
            <div className="mx-5 mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* En celular el ticket queda debajo de las 268 tarjetas: sin esta barra
          habría que scrollear todo el catálogo para cobrar. */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] lg:hidden">
          <div>
            <p className="text-xs text-navy/55">
              {totalItems} {totalItems === 1 ? 'unidad' : 'unidades'}
            </p>
            <p className="text-lg font-bold tabular-nums text-navy">{formatPrice(subtotal)}</p>
          </div>
          <button
            type="button"
            onClick={() => ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-accent-dark"
          >
            <ShoppingBag className="h-4 w-4" /> Ver pedido
          </button>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  rank,
  enCarrito,
  onAdd,
}: {
  product: PosProduct;
  rank?: number;
  enCarrito: Map<string, number>;
  onAdd: (p: PosProduct, v: PosVariant) => void;
}) {
  const agotado = product.stock <= 0;

  return (
    <div
      data-pos-card={product.id}
      className={cn(
        'flex flex-col rounded-xl border bg-white p-3 transition hover:shadow-md',
        agotado ? 'border-line/70' : 'border-line',
      )}
    >
      <div className="flex items-start gap-3">
        {product.image ? (
          // next/image y no <img>: las fotos guardadas son de 900px y acá se
          // ven a 56. Con 268 tarjetas en pantalla, servirlas en crudo son
          // megas de más en el celular del local.
          <div
            className={cn(
              'relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white',
              agotado && 'opacity-50',
            )}
          >
            <Image src={product.image} alt="" fill sizes="56px" className="object-contain" />
          </div>
        ) : (
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-bg-2 text-[10px] text-navy/30">
            sin foto
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-navy">{displayName(product.name)}</p>
          {product.brand && (
            <p className="text-xs font-medium uppercase tracking-wide text-navy/50">
              {product.brand}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className={cn('font-medium tabular-nums', agotado ? 'text-red-500' : 'text-navy/45')}>
              {agotado ? 'Sin stock' : `Stock ${product.stock}`}
            </span>
            {product.sold > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums',
                  rank ? 'bg-accent/10 text-accent-dark' : 'bg-bg-2 text-navy/55',
                )}
                title={`${product.sold} unidades vendidas`}
              >
                {rank && <Flame className="h-3 w-3" />}
                {product.sold} {product.sold === 1 ? 'vendida' : 'vendidas'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {product.variants.length === 0 ? (
          <span className="text-xs text-navy/40">Este producto no tiene precios cargados</span>
        ) : (
          product.variants.map((v) => {
            const cantidad = enCarrito.get(v.id) ?? 0;
            const sinStock = variantStock(product, v) <= 0;
            return (
              <button
                key={v.id}
                onClick={() => onAdd(product, v)}
                title={sinStock ? 'Sin stock — se puede vender igual' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  cantidad > 0
                    ? 'border-accent bg-accent/10 text-accent-dark'
                    : 'border-line bg-bg text-navy hover:border-accent hover:bg-accent/5',
                  sinStock && cantidad === 0 && 'text-navy/45',
                )}
              >
                {cantidad > 0 ? (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-white tabular-nums">
                    {cantidad}
                  </span>
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                {v.label} — {formatPrice(v.price)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
