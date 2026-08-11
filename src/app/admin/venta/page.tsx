'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingBag, Check, Loader2 } from 'lucide-react';
import { createLocalOrderAction } from '../actions';

interface Variant {
  id: string;
  label: string;
  price: number;
  originalPrice: number | null;
}

interface SearchProduct {
  id: string;
  name: string;
  stock: number;
  images: { url: string }[];
  brand: { name: string } | null;
  variants: Variant[];
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

function formatPrice(n: number) {
  return '$' + n.toLocaleString('es-AR');
}

function displayName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PosPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Búsqueda con debounce
  const search = useCallback((q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } catch { /* red */ }
      setSearching(false);
    }, 300);
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  function addToCart(product: SearchProduct, variant: Variant) {
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
          image: product.images[0]?.url ?? null,
        },
      ];
    });
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
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
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(result.error ?? 'Error desconocido');
      }
    } catch {
      setError('Error de conexión');
    }

    setSending(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Punto de Venta</h1>
        <p className="text-sm text-navy/55">Cargá pedidos desde el local</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Columna izquierda: buscador + resultados */}
        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto por nombre o marca..."
              className="w-full rounded-xl border border-line bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-navy/40" />
            )}
          </div>

          {/* Resultados de búsqueda */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((product) => (
                <div
                  key={product.id}
                  className="rounded-xl border border-line bg-white p-4 transition hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    {product.images[0] && (
                      <img
                        src={product.images[0].url}
                        alt=""
                        className="h-14 w-14 rounded-lg bg-white object-contain"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">{displayName(product.name)}</p>
                      {product.brand && (
                        <p className="text-xs font-medium uppercase tracking-wide text-navy/50">
                          {product.brand.name}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-navy/40">Stock: {product.stock}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => addToCart(product, v)}
                        className="flex items-center gap-1.5 rounded-full border border-line bg-bg px-3 py-1.5 text-xs font-medium text-navy transition hover:border-accent hover:bg-accent/5"
                      >
                        <Plus className="h-3 w-3" />
                        {v.label} — {formatPrice(v.price)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {query.length >= 2 && results.length === 0 && !searching && (
            <p className="py-8 text-center text-sm text-navy/40">
              No se encontraron productos para &quot;{query}&quot;
            </p>
          )}
        </div>

        {/* Columna derecha: carrito / ticket */}
        <div className="rounded-xl border border-line bg-white lg:sticky lg:top-24">
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
                Buscá un producto y agregalo
              </p>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => (
                  <div key={line.variantId} className="flex items-center gap-3">
                    {line.image && (
                      <img src={line.image} alt="" className="h-10 w-10 rounded bg-white object-contain" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy">{displayName(line.productName)}</p>
                      <p className="text-xs text-navy/50">
                        {line.variantLabel} — {formatPrice(line.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                        className="grid h-7 w-7 place-items-center rounded-full border border-line text-navy/60 transition hover:bg-bg"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums text-navy">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                        className="grid h-7 w-7 place-items-center rounded-full border border-line text-navy/60 transition hover:bg-bg"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setQuantity(line.variantId, 0)}
                        className="ml-1 grid h-7 w-7 place-items-center rounded-full text-red-400 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="w-20 text-right text-sm font-semibold tabular-nums text-navy">
                      {formatPrice(line.price * line.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="border-t border-line px-5 py-4 space-y-3">
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
                <span className="text-xl font-bold tabular-nums text-navy">{formatPrice(subtotal)}</span>
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
    </div>
  );
}
