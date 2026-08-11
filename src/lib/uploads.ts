import { resolve, normalize, sep } from 'node:path';

/**
 * Dónde viven las imágenes subidas.
 *
 * NO es `public/`: Next arma la lista de archivos estáticos al arrancar, así que
 * una foto subida desde el panel no se serviría hasta reiniciar el contenedor.
 * Se guardan afuera y las sirve `/uploads/[...file]`.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? resolve(process.env.UPLOADS_DIR)
  : resolve(process.cwd(), 'uploads');

/**
 * Resuelve un nombre de archivo pedido por URL contra el directorio de subidas,
 * o null si intenta salirse de ahí (../../etc/passwd y variantes).
 */
export function safeUploadPath(segments: string[]): string | null {
  const rel = normalize(segments.join('/'));
  if (rel.startsWith('..') || rel.includes(`..${sep}`) || rel.startsWith('/')) return null;
  const full = resolve(UPLOADS_DIR, rel);
  if (full !== UPLOADS_DIR && !full.startsWith(UPLOADS_DIR + sep)) return null;
  return full;
}
