import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Healthcheck para el contenedor.
 *
 * Toca la base a propósito: un proceso que responde pero no puede leer el
 * catálogo no está sano, y conviene que el orquestador lo reinicie.
 */
export async function GET() {
  try {
    // `products` son los que ve el cliente; `total` incluye los ocultos. El
    // total es el que nunca puede bajar: si baja, se perdió catálogo.
    const [products, total] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.product.count(),
    ]);
    return NextResponse.json({ ok: true, products, total });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
