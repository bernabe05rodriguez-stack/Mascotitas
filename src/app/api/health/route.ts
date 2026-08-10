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
    const products = await prisma.product.count({ where: { active: true } });
    return NextResponse.json({ ok: true, products });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
