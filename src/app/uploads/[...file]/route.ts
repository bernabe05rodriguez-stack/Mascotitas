import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { safeUploadPath } from '@/lib/uploads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIPOS: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
};

/**
 * Sirve las imágenes del catálogo y las que se suben desde el panel.
 *
 * Existe porque Next no sirve archivos que aparecen en `public/` después de
 * arrancar: una foto recién subida daría 404 hasta reiniciar el contenedor.
 */
export async function GET(_req: Request, { params }: { params: { file: string[] } }) {
  const path = safeUploadPath(params.file ?? []);
  if (!path) return new NextResponse('No encontrado', { status: 404 });

  const tipo = TIPOS[extname(path).toLowerCase()];
  if (!tipo) return new NextResponse('No encontrado', { status: 404 });

  try {
    const info = await stat(path);
    if (!info.isFile()) return new NextResponse('No encontrado', { status: 404 });

    const buf = await readFile(path);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': tipo,
        'Content-Length': String(info.size),
        // El nombre lleva el hash del contenido: si cambia la foto, cambia la URL.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new NextResponse('No encontrado', { status: 404 });
  }
}
