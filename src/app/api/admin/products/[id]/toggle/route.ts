import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Alterna "visible en la tienda" o "destacado" de un producto.
 *
 * Es una ruta de API y no una server action a propósito: una server action
 * vuelve a renderizar la página que la invocó, y como la tabla filtra por
 * estado, la fila recién ocultada desaparecía de la lista y el cambio parecía
 * no haber hecho nada. Con fetch, la tabla se queda como está y la fila muestra
 * su nuevo estado con un "Deshacer" al lado.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let field: unknown;
  try {
    field = (await req.json()).field;
  } catch {
    return NextResponse.json({ error: 'Pedido mal formado' }, { status: 400 });
  }

  if (field !== 'active' && field !== 'featured') {
    return NextResponse.json({ error: 'Campo inválido' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    select: { active: true, featured: true, slug: true },
  });
  if (!product) return NextResponse.json({ error: 'El producto no existe' }, { status: 404 });

  const value = !product[field];
  await prisma.product.update({ where: { id: params.id }, data: { [field]: value } });

  // La tienda sí tiene que reflejarlo enseguida.
  revalidatePath('/', 'page');
  revalidatePath('/catalogo', 'page');
  revalidatePath(`/producto/${product.slug}`, 'page');
  revalidatePath('/sitemap.xml');

  return NextResponse.json({ ok: true, field, value });
}
