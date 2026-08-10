import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * Subida de imágenes desde el panel.
 *
 * `requireAdmin()` va acá adentro, no en el middleware: el middleware de Next
 * no cubre las rutas de API (la lección de Guchini).
 *
 * Todo se normaliza a WebP con fondo blanco, igual que las fotos migradas: las
 * del catálogo vienen con fondo blanco embebido y si una nueva no lo tiene, se
 * ve como un recuadro pegado dentro de la card.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No llegó ningún archivo' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen supera los 12 MB' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Formato no soportado. Usá JPG, PNG o WebP.' }, { status: 400 });
  }

  const dir = resolve(process.cwd(), 'public/uploads');
  await mkdir(dir, { recursive: true });

  const buf = Buffer.from(await file.arrayBuffer());
  const base = randomUUID().replace(/-/g, '').slice(0, 16);

  try {
    for (const { suffix, width } of [
      { suffix: 'sm', width: 400 },
      { suffix: 'lg', width: 900 },
    ]) {
      const out = await sharp(buf)
        .rotate()
        .resize({ width, height: width, fit: 'contain', background: '#ffffff' })
        .flatten({ background: '#ffffff' })
        .webp({ quality: 82 })
        .toBuffer();
      await writeFile(resolve(dir, `${base}-${suffix}.webp`), out);
    }
  } catch {
    return NextResponse.json({ error: 'No se pudo procesar la imagen' }, { status: 400 });
  }

  return NextResponse.json({ url: `/uploads/${base}-lg.webp` });
}
