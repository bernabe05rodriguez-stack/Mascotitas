/**
 * Prueba del ciclo de stock atado al estado del pedido.
 *
 * Corre contra la base de desarrollo y usa las MISMAS funciones que el panel
 * (`src/lib/stock.ts`), no una copia: si la regla cambia y esto no se entera,
 * la prueba falla.
 *
 *   npx tsx scripts/test-stock.ts
 */
import { PrismaClient } from '@prisma/client';
import { syncOrderStock, releaseOrderStock } from '../src/lib/stock';

const prisma = new PrismaClient();

let fallos = 0;
function check(nombre: string, actual: unknown, esperado: unknown) {
  const ok = actual === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${nombre} → ${actual}${ok ? '' : ` (esperaba ${esperado})`}`);
}

async function stockDe(productId: string) {
  const p = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { stock: true, available: true },
  });
  return p;
}

async function main() {
  // ---------------------------------------------------------------- montaje
  const cat = await prisma.category.upsert({
    where: { slug: 'test-stock' },
    update: {},
    create: { slug: 'test-stock', name: 'Test Stock' },
  });

  await prisma.product.deleteMany({ where: { slug: { startsWith: 'test-stock-' } } });

  const producto = await prisma.product.create({
    data: {
      slug: 'test-stock-alimento',
      name: 'ALIMENTO DE PRUEBA',
      categoryId: cat.id,
      stock: 10,
      available: true,
      variants: { create: [{ label: '3KG', price: 1000, order: 0 }] },
    },
    include: { variants: true },
  });
  const variante = producto.variants[0];

  console.log('\n— Pedido web: sólo descuenta cuando se ENTREGA —');

  const pedido = await prisma.order.create({
    data: {
      status: 'PENDIENTE',
      subtotal: 3000,
      total: 3000,
      items: {
        create: {
          productId: producto.id,
          variantId: variante.id,
          productName: producto.name,
          variantLabel: variante.label,
          quantity: 3,
          unitPrice: 1000,
        },
      },
    },
  });

  check('stock inicial', (await stockDe(producto.id)).stock, 10);

  // PENDIENTE → CONFIRMADO: la mercadería todavía no salió.
  await prisma.$transaction((tx) => syncOrderStock(tx, pedido.id, 'CONFIRMADO'));
  check('CONFIRMADO no descuenta', (await stockDe(producto.id)).stock, 10);

  // CONFIRMADO → ENTREGADO: acá sí.
  await prisma.$transaction((tx) => syncOrderStock(tx, pedido.id, 'ENTREGADO'));
  check('ENTREGADO descuenta 3', (await stockDe(producto.id)).stock, 7);

  // Idempotencia: volver a marcar ENTREGADO no puede restar de nuevo.
  await prisma.$transaction((tx) => syncOrderStock(tx, pedido.id, 'ENTREGADO'));
  await prisma.$transaction((tx) => syncOrderStock(tx, pedido.id, 'ENTREGADO'));
  check('ENTREGADO repetido no re-descuenta', (await stockDe(producto.id)).stock, 7);

  // Vuelta atrás: se devuelve.
  await prisma.$transaction((tx) => syncOrderStock(tx, pedido.id, 'CANCELADO'));
  check('CANCELADO devuelve el stock', (await stockDe(producto.id)).stock, 10);

  // Ciclo completo ENTREGADO→CANCELADO→ENTREGADO.
  await prisma.$transaction((tx) => syncOrderStock(tx, pedido.id, 'ENTREGADO'));
  await prisma.$transaction((tx) => syncOrderStock(tx, pedido.id, 'CANCELADO'));
  await prisma.$transaction((tx) => syncOrderStock(tx, pedido.id, 'ENTREGADO'));
  check('ida y vuelta deja el stock correcto', (await stockDe(producto.id)).stock, 7);

  console.log('\n— available acompaña al stock —');
  await prisma.product.update({ where: { id: producto.id }, data: { stock: 3, available: true } });
  const p2 = await prisma.order.create({
    data: {
      status: 'CONFIRMADO',
      subtotal: 3000,
      total: 3000,
      items: {
        create: {
          productId: producto.id,
          variantId: variante.id,
          productName: producto.name,
          variantLabel: variante.label,
          quantity: 3,
          unitPrice: 1000,
        },
      },
    },
  });
  await prisma.$transaction((tx) => syncOrderStock(tx, p2.id, 'ENTREGADO'));
  const agotado = await stockDe(producto.id);
  check('stock llega a 0', agotado.stock, 0);
  check('available pasa a false', agotado.available, false);

  console.log('\n— Borrar un pedido entregado devuelve el stock —');
  await prisma.$transaction(async (tx) => {
    await releaseOrderStock(tx, p2.id);
    await tx.order.delete({ where: { id: p2.id } });
  });
  const trasBorrar = await stockDe(producto.id);
  check('stock devuelto al borrar', trasBorrar.stock, 3);
  check('available vuelve a true', trasBorrar.available, true);

  console.log('\n— Borrar un pedido NO entregado no infla el stock —');
  const p3 = await prisma.order.create({
    data: {
      status: 'PENDIENTE',
      subtotal: 1000,
      total: 1000,
      items: {
        create: {
          productId: producto.id,
          variantId: variante.id,
          productName: producto.name,
          variantLabel: variante.label,
          quantity: 1,
          unitPrice: 1000,
        },
      },
    },
  });
  await prisma.$transaction(async (tx) => {
    await releaseOrderStock(tx, p3.id);
    await tx.order.delete({ where: { id: p3.id } });
  });
  check('stock intacto', (await stockDe(producto.id)).stock, 3);

  console.log('\n— Stock propio de la variante manda sobre el del producto —');
  const conVariante = await prisma.product.create({
    data: {
      slug: 'test-stock-variante',
      name: 'PRODUCTO CON STOCK POR VARIANTE',
      categoryId: cat.id,
      stock: 50,
      variants: { create: [{ label: '15KG', price: 2000, stock: 4, order: 0 }] },
    },
    include: { variants: true },
  });
  const v2 = conVariante.variants[0];
  const p4 = await prisma.order.create({
    data: {
      status: 'CONFIRMADO',
      subtotal: 4000,
      total: 4000,
      items: {
        create: {
          productId: conVariante.id,
          variantId: v2.id,
          productName: conVariante.name,
          variantLabel: v2.label,
          quantity: 2,
          unitPrice: 2000,
        },
      },
    },
  });
  await prisma.$transaction((tx) => syncOrderStock(tx, p4.id, 'ENTREGADO'));
  const vRefrescada = await prisma.variant.findUniqueOrThrow({ where: { id: v2.id } });
  check('descuenta de la variante', vRefrescada.stock, 2);
  check('no toca el stock del producto', (await stockDe(conVariante.id)).stock, 50);

  console.log('\n— No se puede quedar en negativo —');
  await prisma.product.update({ where: { id: producto.id }, data: { stock: 1 } });
  const p5 = await prisma.order.create({
    data: {
      status: 'CONFIRMADO',
      subtotal: 5000,
      total: 5000,
      items: {
        create: {
          productId: producto.id,
          variantId: variante.id,
          productName: producto.name,
          variantLabel: variante.label,
          quantity: 5,
          unitPrice: 1000,
        },
      },
    },
  });
  await prisma.$transaction((tx) => syncOrderStock(tx, p5.id, 'ENTREGADO'));
  check('el piso es 0, no negativo', (await stockDe(producto.id)).stock, 0);

  // ------------------------------------------------------------- limpieza
  await prisma.order.deleteMany({ where: { id: { in: [pedido.id, p4.id, p5.id] } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: 'test-stock-' } } });
  await prisma.category.delete({ where: { id: cat.id } });

  console.log(fallos === 0 ? '\n✅ Todo el ciclo de stock funciona.\n' : `\n❌ ${fallos} comprobaciones fallaron.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
