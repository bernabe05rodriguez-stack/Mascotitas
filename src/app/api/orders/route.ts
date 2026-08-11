import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { RateLimiter, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 50;
const MAX_QTY = 99;

// Máximo 10 pedidos por minuto por IP — más que suficiente para uso real.
const limiter = new RateLimiter(10, 60_000);

interface IncomingItem {
  variantId: string;
  quantity: number;
}

/**
 * Registra un pedido antes de mandarlo por WhatsApp.
 *
 * Los precios NUNCA se toman del cliente: llegan sólo `variantId` y cantidad, y
 * el importe se resuelve contra la base. Si no, cualquiera podría postear un
 * pedido de 15 kg de Royal Canin a $1.
 */
export async function POST(req: Request) {
  if (!limiter.check(getClientIp(req))) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá un momento.' }, { status: 429 });
  }

  let body: { customerName?: unknown; phone?: unknown; couponCode?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Pedido mal formado' }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: IncomingItem[] = rawItems
    .filter((i): i is IncomingItem => {
      if (!i || typeof i !== 'object') return false;
      const item = i as Partial<IncomingItem>;
      return typeof item.variantId === 'string' && typeof item.quantity === 'number';
    })
    .slice(0, MAX_ITEMS)
    .map((i) => ({ variantId: i.variantId, quantity: Math.min(Math.max(1, Math.trunc(i.quantity)), MAX_QTY) }));

  if (items.length === 0) {
    return NextResponse.json({ error: 'El pedido está vacío' }, { status: 400 });
  }

  const variants = await prisma.variant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: { select: { id: true, name: true } } },
  });

  if (variants.length === 0) {
    return NextResponse.json({ error: 'Ninguno de los productos existe' }, { status: 400 });
  }

  const byId = new Map(variants.map((v) => [v.id, v]));
  const orderItems = items
    .filter((i) => byId.has(i.variantId))
    .map((i) => {
      const v = byId.get(i.variantId)!;
      return {
        productId: v.product.id,
        productName: v.product.name,
        variantLabel: v.label,
        quantity: i.quantity,
        unitPrice: v.price, // precio de la base, no del navegador
      };
    });

  const subtotal = orderItems.reduce((n, i) => n + i.unitPrice * i.quantity, 0);

  /* cupón: se revalida acá, no se confía en lo que diga el cliente */
  let discount = 0;
  let couponCode: string | null = null;
  if (typeof body.couponCode === 'string' && body.couponCode.trim()) {
    const code = body.couponCode.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    const usable =
      coupon &&
      coupon.active &&
      (!coupon.expiresAt || coupon.expiresAt >= new Date()) &&
      (coupon.usageLimit == null || coupon.usageCount < coupon.usageLimit) &&
      (coupon.minTotal == null || subtotal >= coupon.minTotal);
    if (usable) {
      discount = Math.round((subtotal * coupon!.percent) / 100);
      couponCode = coupon!.code;
    }
  }

  const total = subtotal - discount;
  const settings = await getSettings();
  const shipping = total >= settings.freeShippingThreshold ? 0 : settings.shippingCost;

  const clean = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        customerName: clean(body.customerName, 120),
        phone: clean(body.phone, 40),
        subtotal,
        discount,
        couponCode,
        shipping,
        total,
        items: { create: orderItems },
      },
      select: { id: true, total: true },
    });

    if (couponCode) {
      await tx.coupon.update({ where: { code: couponCode }, data: { usageCount: { increment: 1 } } });
    }

    return created;
  });

  return NextResponse.json({ number: order.id, total: order.total, subtotal, discount });
}
