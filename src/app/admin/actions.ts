'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAdmin, createSession, destroySession, verifyCredentials } from '@/lib/auth';
import { recomputeAggregates } from '@/lib/aggregates';
import { saveSettings, type ShopSettings } from '@/lib/settings';
import { slugify } from '@/lib/slug';

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Refresca las páginas públicas cacheadas tras un cambio del panel. */
function revalidateShop(slug?: string) {
  revalidatePath('/', 'page');
  revalidatePath('/catalogo', 'page');
  if (slug) revalidatePath(`/producto/${slug}`, 'page');
  revalidatePath('/sitemap.xml');
}

/* ------------------------------------------------------------------ login */

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { ok: false, error: 'Completá usuario y contraseña' };

  const user = await verifyCredentials(email, password);
  if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos' };

  await createSession(user);
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  destroySession();
  redirect('/admin/login');
}

/* --------------------------------------------------------------- productos */

/** Edición rápida desde la tabla: precio y stock sin abrir el producto. */
export async function quickUpdateAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const productId = String(formData.get('productId') ?? '');
  const stockRaw = formData.get('stock');
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (!product) return { ok: false, error: 'El producto no existe' };

  if (stockRaw != null) {
    const stock = Math.max(0, Math.trunc(Number(stockRaw) || 0));
    await prisma.product.update({ where: { id: productId }, data: { stock } });
  }

  // Los precios llegan como price_<variantId>
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('price_')) continue;
    const variantId = key.slice('price_'.length);
    const price = Math.max(0, Math.trunc(Number(value) || 0));
    if (price > 0) await prisma.variant.update({ where: { id: variantId }, data: { price } });
  }

  await recomputeAggregates(productId);
  revalidateShop(product.slug);
  revalidatePath('/admin/productos');
  return { ok: true, message: 'Guardado' };
}

export async function saveProductAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '') || null;
  const name = String(formData.get('name') ?? '').trim();
  const categoryId = String(formData.get('categoryId') ?? '');
  const brandId = String(formData.get('brandId') ?? '') || null;
  const petTypeRaw = String(formData.get('petType') ?? '');
  const description = String(formData.get('description') ?? '').trim() || null;
  const stock = Math.max(0, Math.trunc(Number(formData.get('stock')) || 0));
  const featured = formData.get('featured') === 'on';
  const active = formData.get('active') === 'on';

  if (!name) return { ok: false, error: 'El nombre es obligatorio' };
  if (!categoryId) return { ok: false, error: 'Elegí una categoría' };

  const petType = petTypeRaw === 'PERRO' || petTypeRaw === 'GATO' || petTypeRaw === 'OTRO' ? petTypeRaw : null;

  /* variantes: llegan como variant_<i>_label / _price / _originalPrice / _id */
  const variants: { id?: string; label: string; price: number; originalPrice: number | null }[] = [];
  for (let i = 0; i < 20; i++) {
    const label = String(formData.get(`variant_${i}_label`) ?? '').trim();
    const priceRaw = formData.get(`variant_${i}_price`);
    if (!label || priceRaw == null || priceRaw === '') continue;
    const price = Math.max(0, Math.trunc(Number(priceRaw) || 0));
    if (price <= 0) continue;
    const originalRaw = formData.get(`variant_${i}_originalPrice`);
    const originalPrice = originalRaw ? Math.trunc(Number(originalRaw) || 0) : 0;
    variants.push({
      id: String(formData.get(`variant_${i}_id`) ?? '') || undefined,
      label: label.toUpperCase(),
      price,
      // Sólo cuenta como oferta si el precio tachado es mayor al que se cobra.
      originalPrice: originalPrice > price ? originalPrice : null,
    });
  }

  if (variants.length === 0) {
    return { ok: false, error: 'Cargá al menos una presentación con precio' };
  }

  /* imágenes: URLs ya subidas, en orden */
  const images = formData.getAll('imageUrls').map(String).filter(Boolean);

  let productId = id;
  let slug: string;

  if (id) {
    const existing = await prisma.product.findUnique({ where: { id }, select: { slug: true, name: true } });
    if (!existing) return { ok: false, error: 'El producto no existe' };
    // El slug sólo cambia si cambió el nombre, para no romper links ya indexados.
    slug = existing.name === name ? existing.slug : await uniqueSlug(name, id);
    await prisma.product.update({
      where: { id },
      data: { name, slug, description, categoryId, brandId, petType, stock, featured, active },
    });
  } else {
    slug = await uniqueSlug(name, null);
    const created = await prisma.product.create({
      data: { name, slug, description, categoryId, brandId, petType, stock, featured, active },
      select: { id: true },
    });
    productId = created.id;
  }

  /* Se reemplazan variantes e imágenes conservando los ids que ya existían, para
     que los pedidos históricos y los carritos abiertos no queden colgados. */
  const keepIds = variants.map((v) => v.id).filter(Boolean) as string[];
  await prisma.variant.deleteMany({ where: { productId: productId!, id: { notIn: keepIds.length ? keepIds : ['-'] } } });

  for (const [order, v] of variants.entries()) {
    if (v.id) {
      await prisma.variant.update({
        where: { id: v.id },
        data: { label: v.label, price: v.price, originalPrice: v.originalPrice, order },
      });
    } else {
      await prisma.variant.create({
        data: { productId: productId!, label: v.label, price: v.price, originalPrice: v.originalPrice, order },
      });
    }
  }

  await prisma.productImage.deleteMany({ where: { productId: productId! } });
  if (images.length) {
    await prisma.productImage.createMany({
      data: images.map((url, order) => ({ productId: productId!, url, alt: name, order })),
    });
  }

  await recomputeAggregates(productId!);
  revalidateShop(slug);
  revalidatePath('/admin/productos');

  return { ok: true, message: id ? 'Producto actualizado' : 'Producto creado' };
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  await requireAdmin();
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true, _count: { select: { orderItems: true } } },
  });
  if (!p) return { ok: false, error: 'El producto no existe' };

  // Si ya se vendió, se desactiva en vez de borrarse: borrarlo dejaría el
  // historial de pedidos sin referencia.
  if (p._count.orderItems > 0) {
    await prisma.product.update({ where: { id: productId }, data: { active: false } });
    revalidateShop(p.slug);
    revalidatePath('/admin/productos');
    return { ok: true, message: 'Tiene pedidos asociados: se desactivó en vez de borrarse' };
  }

  await prisma.product.delete({ where: { id: productId } });
  revalidateShop(p.slug);
  revalidatePath('/admin/productos');
  return { ok: true, message: 'Producto eliminado' };
}

async function uniqueSlug(name: string, excludeId: string | null): Promise<string> {
  const base = slugify(name) || 'producto';
  let candidate = base;
  for (let i = 2; i < 500; i++) {
    const clash = await prisma.product.findFirst({ where: { slug: candidate, NOT: excludeId ? { id: excludeId } : undefined }, select: { id: true } });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

/* ---------------------------------------------------------------- pedidos */

export async function updateOrderStatusAction(orderId: number, status: string): Promise<ActionResult> {
  await requireAdmin();
  if (!['PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'CANCELADO'].includes(status)) {
    return { ok: false, error: 'Estado inválido' };
  }
  await prisma.order.update({ where: { id: orderId }, data: { status: status as never } });
  revalidatePath('/admin/pedidos');
  return { ok: true };
}

/** Crea un pedido desde el punto de venta del local. */
export async function createLocalOrderAction(data: {
  customerName?: string;
  note?: string;
  items: { variantId: string; quantity: number }[];
}): Promise<ActionResult & { orderId?: number }> {
  await requireAdmin();

  if (!data.items?.length) return { ok: false, error: 'Agregá al menos un producto' };

  const variants = await prisma.variant.findMany({
    where: { id: { in: data.items.map((i) => i.variantId) } },
    include: { product: { select: { id: true, name: true, stock: true } } },
  });

  if (variants.length === 0) return { ok: false, error: 'Ningún producto existe' };

  const byId = new Map(variants.map((v) => [v.id, v]));
  const orderItems = data.items
    .filter((i) => byId.has(i.variantId))
    .map((i) => {
      const v = byId.get(i.variantId)!;
      const qty = Math.min(Math.max(1, Math.trunc(i.quantity)), 99);
      return {
        productId: v.product.id,
        productName: v.product.name,
        variantLabel: v.label,
        quantity: qty,
        unitPrice: v.price,
      };
    });

  const subtotal = orderItems.reduce((n, i) => n + i.unitPrice * i.quantity, 0);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        channel: 'LOCAL',
        status: 'CONFIRMADO',
        customerName: data.customerName?.trim() || null,
        note: data.note?.trim() || null,
        subtotal,
        discount: 0,
        shipping: 0,
        total: subtotal,
        items: { create: orderItems },
      },
      select: { id: true, total: true },
    });

    // Descontar stock
    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return created;
  });

  revalidatePath('/admin/pedidos');
  revalidatePath('/admin/venta');
  revalidateShop();
  return { ok: true, message: `Pedido #${order.id} registrado — $${order.total.toLocaleString('es-AR')}`, orderId: order.id };
}

/* ---------------------------------------------------------------- cupones */

export async function saveCouponAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  const percent = Math.trunc(Number(formData.get('percent')) || 0);
  const minTotalRaw = formData.get('minTotal');
  const expiresRaw = String(formData.get('expiresAt') ?? '');
  const usageLimitRaw = formData.get('usageLimit');

  if (!code) return { ok: false, error: 'Falta el código' };
  if (percent < 1 || percent > 90) return { ok: false, error: 'El descuento tiene que estar entre 1 y 90%' };

  await prisma.coupon.upsert({
    where: { code },
    create: {
      code,
      percent,
      minTotal: minTotalRaw ? Math.trunc(Number(minTotalRaw)) || null : null,
      expiresAt: expiresRaw ? new Date(expiresRaw) : null,
      usageLimit: usageLimitRaw ? Math.trunc(Number(usageLimitRaw)) || null : null,
    },
    update: {
      percent,
      minTotal: minTotalRaw ? Math.trunc(Number(minTotalRaw)) || null : null,
      expiresAt: expiresRaw ? new Date(expiresRaw) : null,
      usageLimit: usageLimitRaw ? Math.trunc(Number(usageLimitRaw)) || null : null,
    },
  });

  revalidatePath('/admin/cupones');
  return { ok: true, message: 'Cupón guardado' };
}

export async function toggleCouponAction(code: string): Promise<ActionResult> {
  await requireAdmin();
  const c = await prisma.coupon.findUnique({ where: { code } });
  if (!c) return { ok: false, error: 'El cupón no existe' };
  await prisma.coupon.update({ where: { code }, data: { active: !c.active } });
  revalidatePath('/admin/cupones');
  return { ok: true };
}

export async function deleteCouponAction(code: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.coupon.delete({ where: { code } });
  revalidatePath('/admin/cupones');
  return { ok: true, message: 'Cupón eliminado' };
}

/* --------------------------------------------------------------- config */

export async function saveSettingsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const num = (k: string, fallback: number) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v >= 0 ? Math.trunc(v) : fallback;
  };
  const str = (k: string) => String(formData.get(k) ?? '').trim();

  const parseRanges = (raw: string): [string, string][] =>
    raw
      .split(',')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => chunk.split('-').map((s) => s.trim()))
      .filter((r): r is [string, string] => r.length === 2 && /^\d{1,2}:\d{2}$/.test(r[0]) && /^\d{1,2}:\d{2}$/.test(r[1]));

  const weekday = parseRanges(str('scheduleWeekday'));
  const weekend = parseRanges(str('scheduleWeekend'));

  if (weekday.length === 0 || weekend.length === 0) {
    return { ok: false, error: 'Los horarios tienen que ir como "09:00-22:00" (varios separados por coma)' };
  }

  const patch: Partial<ShopSettings> = {
    whatsapp: str('whatsapp').replace(/\D/g, ''),
    facebook: str('facebook'),
    instagram: str('instagram'),
    address: str('address'),
    city: str('city'),
    freeShippingThreshold: num('freeShippingThreshold', 20000),
    shippingCost: num('shippingCost', 4300),
    scheduleWeekday: weekday,
    scheduleWeekend: weekend,
    holidays: str('holidays')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
    announcement: str('announcement'),
  };

  await saveSettings(patch);
  revalidateShop();
  revalidatePath('/admin/config');
  return { ok: true, message: 'Configuración guardada' };
}

/* ------------------------------------------------------ categorías y marcas */

export async function saveCategoryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '') || null;
  const name = String(formData.get('name') ?? '').trim();
  const parentId = String(formData.get('parentId') ?? '') || null;
  const icon = String(formData.get('icon') ?? '').trim() || null;
  const order = Math.trunc(Number(formData.get('order')) || 0);

  if (!name) return { ok: false, error: 'Falta el nombre' };
  if (id && parentId === id) return { ok: false, error: 'Una categoría no puede ser su propia madre' };

  if (id) {
    await prisma.category.update({ where: { id }, data: { name, parentId, icon, order } });
  } else {
    await prisma.category.create({ data: { name, slug: slugify(name), parentId, icon, order } });
  }

  revalidateShop();
  revalidatePath('/admin/categorias');
  return { ok: true, message: 'Categoría guardada' };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) return { ok: false, error: `Tiene ${count} productos: moverlos primero a otra categoría` };
  const children = await prisma.category.count({ where: { parentId: id } });
  if (children > 0) return { ok: false, error: 'Tiene subcategorías: borrarlas primero' };
  await prisma.category.delete({ where: { id } });
  revalidateShop();
  revalidatePath('/admin/categorias');
  return { ok: true, message: 'Categoría eliminada' };
}

/* --------------------------------------------------------------- banners */

export async function saveBannerAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '') || null;
  const title = String(formData.get('title') ?? '').trim();
  const imageUrl = String(formData.get('imageUrl') ?? '').trim();
  const mobileUrl = String(formData.get('mobileUrl') ?? '').trim() || null;
  const linkUrl = String(formData.get('linkUrl') ?? '').trim() || null;
  const alt = String(formData.get('alt') ?? '').trim() || null;
  const active = formData.get('active') === 'on';
  const order = Math.trunc(Number(formData.get('order')) || 0);
  const startsRaw = String(formData.get('startsAt') ?? '');
  const endsRaw = String(formData.get('endsAt') ?? '');

  if (!title) return { ok: false, error: 'Ponele un nombre para reconocerlo' };
  if (!imageUrl) return { ok: false, error: 'Subí la imagen del banner' };

  const startsAt = startsRaw ? new Date(startsRaw) : null;
  const endsAt = endsRaw ? new Date(endsRaw) : null;
  if (startsAt && endsAt && endsAt < startsAt) {
    return { ok: false, error: 'La fecha de fin es anterior a la de inicio' };
  }

  const data = { title, imageUrl, mobileUrl, linkUrl, alt, active, order, startsAt, endsAt };

  if (id) await prisma.banner.update({ where: { id }, data });
  else await prisma.banner.create({ data });

  revalidateShop();
  revalidatePath('/admin/banners');
  return { ok: true, message: id ? 'Banner actualizado' : 'Banner creado' };
}

export async function toggleBannerAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const b = await prisma.banner.findUnique({ where: { id }, select: { active: true } });
  if (!b) return { ok: false, error: 'El banner no existe' };
  await prisma.banner.update({ where: { id }, data: { active: !b.active } });
  revalidateShop();
  revalidatePath('/admin/banners');
  return { ok: true };
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.banner.delete({ where: { id } });
  revalidateShop();
  revalidatePath('/admin/banners');
  return { ok: true, message: 'Banner eliminado' };
}

export async function moveBannerAction(id: string, dir: 'up' | 'down'): Promise<ActionResult> {
  await requireAdmin();
  const all = await prisma.banner.findMany({ orderBy: { order: 'asc' }, select: { id: true } });
  const i = all.findIndex((b) => b.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return { ok: true };

  // Se reescribe el orden entero: si dos banners quedaron con el mismo número,
  // intercambiar sólo esos dos no cambiaría nada.
  const reordered = [...all];
  [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
  await prisma.$transaction(
    reordered.map((b, order) => prisma.banner.update({ where: { id: b.id }, data: { order } })),
  );

  revalidateShop();
  revalidatePath('/admin/banners');
  return { ok: true };
}
