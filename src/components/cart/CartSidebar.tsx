'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { X, ShoppingCart, Trash2, Minus, Plus, PawPrint, Loader2 } from 'lucide-react';
import { useCart } from './CartProvider';
import { trackEvent } from '@/components/Analytics';
import { formatPrice, displayName, cn } from '@/lib/format';

interface Props {
  whatsapp: string;
  freeShippingThreshold: number;
  shippingCost: number;
}

interface CouponState {
  code: string;
  percent: number;
}

export function CartSidebar({ whatsapp, freeShippingThreshold, shippingCost }: Props) {
  const { lines, subtotal, isOpen, close, setQuantity, remove, clear, count } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponState | null>(null);
  const [couponError, setCouponError] = useState('');
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Bloquear el scroll de atrás mientras el panel está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const discount = coupon ? Math.round((subtotal * coupon.percent) / 100) : 0;
  const total = subtotal - discount;
  const freeShipping = total >= freeShippingThreshold;
  const missingForFreeShipping = Math.max(0, freeShippingThreshold - total);

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setChecking(true);
    setCouponError('');
    try {
      // La validación es del lado del servidor: el porcentaje ya no viaja en el
      // HTML, así que no se puede inventar un cupón desde la consola del navegador.
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCoupon(null);
        setCouponError(data.error ?? 'Cupón inválido');
      } else {
        setCoupon({ code: data.code, percent: data.percent });
        setCouponError('');
      }
    } catch {
      setCouponError('No se pudo verificar el cupón');
    } finally {
      setChecking(false);
    }
  }

  async function checkout() {
    if (lines.length === 0) return;
    setSending(true);

    let orderNumber: number | null = null;
    try {
      // El pedido queda registrado ANTES de abrir WhatsApp. Hasta ahora la única
      // constancia de una venta era el chat.
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim() || null,
          phone: phone.trim() || null,
          couponCode: coupon?.code ?? null,
          items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        }),
      });
      if (res.ok) orderNumber = (await res.json()).number ?? null;
    } catch {
      // Si el registro falla, igual mandamos el pedido por WhatsApp: perder una
      // venta por un error de red sería mucho peor que perder la estadística.
    }

    const lineText = lines
      .map((l) => `• ${l.quantity}x ${displayName(l.name)}${l.variantLabel !== 'Unidad' ? ` (${l.variantLabel})` : ''} — ${formatPrice(l.unitPrice * l.quantity)}`)
      .join('\n');

    let msg = `¡Hola Mascotitas! 🐾 Quiero hacer este pedido:\n\n${lineText}\n`;
    if (orderNumber) msg += `\nPedido #${orderNumber}`;
    msg += `\nSubtotal: ${formatPrice(subtotal)}`;
    if (coupon) msg += `\nDescuento ${coupon.code} (${coupon.percent}%): -${formatPrice(discount)}`;
    msg += `\n*Total: ${formatPrice(total)}*`;
    msg += freeShipping
      ? `\nEnvío Bonificado: ~${formatPrice(shippingCost)}~ 🚚`
      : `\nEnvío: a coordinar según zona (se cobra en pedidos menores a ${formatPrice(freeShippingThreshold)}) 🚚`;
    if (name.trim()) msg += `\n\nMi nombre: ${name.trim()}`;

    window.open(`https://api.whatsapp.com/send?phone=${whatsapp}&text=${encodeURIComponent(msg)}`, '_blank');
    trackEvent('begin_checkout', {
      value: subtotal,
      items: lines.length,
      currency: 'ARS',
    });
    setSending(false);
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-navy/60 backdrop-blur-sm transition-opacity',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={close}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-line bg-white shadow-2xl transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-line bg-bg px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
            <ShoppingCart className="h-5 w-5 text-accent" />
            Tu pedido
            {count > 0 && <span className="text-sm font-medium text-navy/50 tabular">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={close}
            className="nav-icon-btn flex h-10 w-10 items-center justify-center rounded-full text-navy"
            aria-label="Cerrar carrito"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                <PawPrint className="h-7 w-7 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-navy">Tu pedido está vacío</p>
                <p className="mt-1 text-sm text-navy/55">Sumá algo rico para tu mascota</p>
              </div>
              <Link href="/catalogo" onClick={close} className="btn-primary rounded-full px-6 py-2.5 text-sm font-semibold">
                Ver catálogo
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.variantId} className="flex gap-3 rounded-xl border border-line bg-white p-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
                    {l.image ? (
                      <Image src={l.image} alt={displayName(l.name)} fill sizes="64px" className="object-contain" />
                    ) : (
                      <div className="h-full w-full bg-bg-2" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-navy">{displayName(l.name)}</p>
                    {l.variantLabel !== 'Unidad' && (
                      <p className="text-xs text-navy/55">{l.variantLabel}</p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-full bg-bg-cream">
                        <button
                          type="button"
                          onClick={() => setQuantity(l.variantId, l.quantity - 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full text-navy transition hover:bg-white"
                          aria-label="Quitar uno"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-navy tabular">{l.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(l.variantId, l.quantity + 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-full text-navy transition hover:bg-white"
                          aria-label="Agregar uno"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <span className="text-sm font-bold text-navy tabular">
                        {formatPrice(l.unitPrice * l.quantity)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(l.variantId)}
                    className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-navy/30 transition hover:bg-red-50 hover:text-red-500"
                    aria-label={`Eliminar ${displayName(l.name)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <footer className="space-y-3 border-t border-line bg-bg px-5 py-4">
            {!freeShipping && (
              <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent-dark">
                Te faltan <strong className="tabular">{formatPrice(missingForFreeShipping)}</strong> para el envío bonificado
              </p>
            )}

            <form onSubmit={applyCoupon} className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Cupón de descuento"
                aria-label="Código de cupón"
                className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm uppercase text-navy placeholder:normal-case placeholder:text-navy/40 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={checking}
                className="btn-outline flex min-h-[42px] shrink-0 items-center rounded-full px-4 py-2 text-sm font-semibold"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
              </button>
            </form>
            {couponError && <p className="text-xs font-medium text-red-500">{couponError}</p>}
            {coupon && (
              <p className="text-xs font-medium text-green-600">
                Cupón {coupon.code} aplicado ({coupon.percent}% off)
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                aria-label="Tu nombre"
                className="rounded-full border border-line bg-white px-4 py-2 text-sm text-navy placeholder:text-navy/40 focus:border-accent focus:outline-none"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono"
                inputMode="tel"
                aria-label="Tu teléfono"
                className="rounded-full border border-line bg-white px-4 py-2 text-sm text-navy placeholder:text-navy/40 focus:border-accent focus:outline-none"
              />
            </div>

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between text-navy/70">
                <dt>Subtotal</dt>
                <dd className="tabular">{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between font-medium text-green-600">
                  <dt>Descuento</dt>
                  <dd className="tabular">−{formatPrice(discount)}</dd>
                </div>
              )}
              <div className="flex items-end justify-between border-t border-line pt-2">
                <dt className="font-semibold text-navy">Total</dt>
                <dd className="text-xl font-bold text-navy tabular">{formatPrice(total)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={checkout}
              disabled={sending}
              className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-whatsapp py-3.5 font-bold text-white shadow-[0_10px_24px_-8px_rgba(37,211,102,.6)] transition hover:brightness-105 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <WhatsAppIcon />}
              {sending ? 'Preparando…' : 'Confirmar por WhatsApp'}
            </button>

            <button
              type="button"
              onClick={clear}
              className="min-h-[42px] w-full rounded-full py-2.5 text-center text-xs font-medium text-navy/40 transition hover:bg-bg-2 hover:text-red-500"
            >
              Vaciar carrito
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.93 11.93 0 005.71 1.454h.006c6.585 0 11.946-5.359 11.949-11.945a11.86 11.86 0 00-3.480-8.408" />
    </svg>
  );
}
