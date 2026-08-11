'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { trackEvent } from '@/components/Analytics';

/**
 * Carrito persistente.
 *
 * Antes esto era imposible: 201 de los 268 productos no tenían id en la
 * planilla y el JS les inventaba uno con Math.random() en cada carga, así que
 * la identidad de un producto cambiaba en cada refresh. Ahora que los ids son
 * estables, el carrito sobrevive a cerrar la pestaña.
 */

const STORAGE_KEY = 'mascotitas.cart.v2';
const MAX_QTY = 99;

export interface CartLine {
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  variantLabel: string;
  unitPrice: number;
  originalPrice: number | null;
  image: string | null;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Se incrementa en cada alta: lo usa el ícono del navbar para animarse. */
  pulse: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function isValidLine(l: unknown): l is CartLine {
  if (!l || typeof l !== 'object') return false;
  const c = l as Partial<CartLine>;
  return (
    typeof c.productId === 'string' &&
    typeof c.variantId === 'string' &&
    typeof c.unitPrice === 'number' &&
    typeof c.quantity === 'number' &&
    c.quantity > 0
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [pulse, setPulse] = useState(0);
  // `ready` evita el flash de "carrito vacío" en el primer render del cliente,
  // antes de que se lea localStorage.
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed.filter(isValidLine));
      }
    } catch {
      // localStorage puede fallar en modo privado de Safari: seguimos sin persistencia.
    }
    hydrated.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* sin persistencia, pero el carrito sigue funcionando en memoria */
    }
  }, [lines]);

  // Si el usuario tiene la tienda abierta en dos pestañas, que no se pisen.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) setLines(parsed.filter(isValidLine));
      } catch {
        /* ignorar payload corrupto */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((line: Omit<CartLine, 'quantity'>, quantity = 1) => {
    trackEvent('add_to_cart', {
      item_id: line.variantId,
      item_name: line.name,
      value: line.unitPrice * quantity,
      quantity,
    });
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.variantId === line.variantId);
      if (idx === -1) return [...prev, { ...line, quantity: Math.min(quantity, MAX_QTY) }];
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        // El precio se refresca por si cambió desde que lo agregó.
        unitPrice: line.unitPrice,
        originalPrice: line.originalPrice,
        quantity: Math.min(next[idx].quantity + quantity, MAX_QTY),
      };
      return next;
    });
    setPulse((p) => p + 1);
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, MAX_QTY) } : l)),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0),
      ready,
      add,
      setQuantity,
      remove,
      clear,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      pulse,
    }),
    [lines, ready, add, setQuantity, remove, clear, isOpen, pulse],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart tiene que usarse dentro de <CartProvider>');
  return ctx;
}
