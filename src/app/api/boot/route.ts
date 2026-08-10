import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Devuelve el log del arranque del contenedor.
 *
 * Existe porque EasyPanel no expone los logs por API: sin esto, un contenedor
 * que no levanta se ve desde afuera como un 502 sin explicación.
 *
 * Protegido con AUTH_SECRET por query string, no con la sesión del panel: si lo
 * que falló fue justamente la conexión a la base, no se puede iniciar sesión.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  const secret = process.env.AUTH_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const log = await readFile('/tmp/boot.log', 'utf8');
    return new NextResponse(log, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch {
    return NextResponse.json({ error: 'No hay log de arranque' }, { status: 404 });
  }
}
