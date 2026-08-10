import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Valida un cupón contra la base.
 *
 * Antes los cupones vivían en una pestaña pública del Sheet que el navegador
 * descargaba entera: cualquiera abría el CSV y veía todos los códigos. Ahora el
 * cliente manda un código y sólo recibe el porcentaje si es válido.
 */
export async function POST(req: Request) {
  let body: { code?: unknown; subtotal?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false, error: 'Pedido mal formado' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const subtotal = typeof body.subtotal === 'number' && body.subtotal > 0 ? body.subtotal : 0;

  if (!code || code.length > 40) {
    return NextResponse.json({ valid: false, error: 'Ingresá un código' }, { status: 400 });
  }

  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.active) {
    return NextResponse.json({ valid: false, error: 'Ese cupón no existe' });
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: 'El cupón venció' });
  }
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    return NextResponse.json({ valid: false, error: 'El cupón ya se agotó' });
  }
  if (coupon.minTotal != null && subtotal < coupon.minTotal) {
    return NextResponse.json({
      valid: false,
      error: `El cupón aplica desde $${coupon.minTotal.toLocaleString('es-AR')}`,
    });
  }

  return NextResponse.json({ valid: true, code: coupon.code, percent: coupon.percent });
}
