/**
 * Prueba de interfaz del punto de venta y de pedidos, con un navegador real.
 *
 *   npx tsx scripts/test-pos-ui.ts [baseUrl]
 *
 * Comprueba lo que se pidió: que la venta presencial deje cargar nombre y
 * teléfono, que el stock de la grilla baje en vivo al armar el ticket, y que
 * confirmar la venta descuente de verdad.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const EMAIL = 'admin@test.local';
const PASSWORD = 'Prueba1234';

const prisma = new PrismaClient();

let fallos = 0;
function check(nombre: string, ok: boolean, extra = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${nombre}${extra ? ` → ${extra}` : ''}`);
}

async function main() {
  /* ------------------------------------------------- producto de prueba */
  const cat = await prisma.category.upsert({
    where: { slug: 'ui-test' },
    update: {},
    create: { slug: 'ui-test', name: 'UI Test' },
  });
  await prisma.product.deleteMany({ where: { slug: 'ui-test-producto' } });
  const prod = await prisma.product.create({
    data: {
      slug: 'ui-test-producto',
      name: 'ZZZUNICO PRODUCTO UI',
      categoryId: cat.id,
      stock: 9,
      available: true,
      variants: { create: [{ label: '1KG', price: 700, order: 0 }] },
    },
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  /* ------------------------------------------------------------- login */
  await page.goto(`${BASE}/admin/login`);
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // El redirect llega desde una server action (navegación del lado del
  // cliente), así que se espera al panel ya renderizado y no a un "load".
  try {
    await page.waitForURL((u) => /\/admin(\/|$)/.test(u.pathname) && !u.pathname.includes('login'), {
      timeout: 20000,
    });
  } catch {
    const alerta = await page.locator('[role="alert"]').first().textContent().catch(() => null);
    console.error(`  login falló. url=${page.url()} error=${alerta ?? 'ninguno'}`);
    throw new Error('No se pudo entrar al panel');
  }
  check('login del panel', page.url().includes('/admin'));

  /* --------------------------------------------------------- punto de venta */
  await page.goto(`${BASE}/admin/venta`);
  await page.waitForSelector('input[aria-label="Buscar productos"]');

  // Aislar el producto de prueba con el buscador.
  await page.fill('input[aria-label="Buscar productos"]', 'ZZZUNICO');
  await page.waitForTimeout(400);

  const card = page.locator('[data-pos-card]').first();
  const stockAntes = await card.locator('text=/Stock \\d+/').first().textContent();
  check('la tarjeta muestra el stock inicial', stockAntes?.includes('9') ?? false, stockAntes ?? '');

  // Agregar 2 unidades y ver que el stock de la grilla baje EN VIVO.
  const botonVariante = card.getByRole('button', { name: /1KG/ });
  await botonVariante.click();
  await page.waitForTimeout(200);
  const stock1 = await card.locator('text=/Stock \\d+/').first().textContent();
  check('stock en vivo tras 1 unidad', stock1?.includes('8') ?? false, stock1 ?? '');

  await botonVariante.click();
  await page.waitForTimeout(200);
  const stock2 = await card.locator('text=/Stock \\d+/').first().textContent();
  check('stock en vivo tras 2 unidades', stock2?.includes('7') ?? false, stock2 ?? '');

  const aviso = await card.locator('text=/en el ticket/').first().textContent();
  check('avisa cuánto se llevó el ticket', aviso?.includes('2') ?? false, aviso?.trim() ?? '');

  /* ------------------------------------------- nombre y teléfono del cliente */
  const inputNombre = page.locator('input[placeholder*="Nombre del cliente"]');
  const inputTel = page.locator('input[placeholder*="Teléfono"]');
  check('hay campo de nombre', (await inputNombre.count()) === 1);
  check('hay campo de teléfono', (await inputTel.count()) === 1);

  await inputNombre.fill('Juana Pérez');
  await inputTel.fill('261 555-8899');

  await page.getByRole('button', { name: /Confirmar pedido/ }).click();
  await page.waitForTimeout(2500);

  /* ------------------------------------------------ verificación en la base */
  const pedido = await prisma.order.findFirst({
    where: { customerName: 'Juana Pérez' },
    orderBy: { id: 'desc' },
    include: { items: true },
  });

  check('el pedido quedó registrado', !!pedido);
  check('guardó el nombre del cliente', pedido?.customerName === 'Juana Pérez', pedido?.customerName ?? '—');
  check('guardó el teléfono normalizado', pedido?.phone === '2615558899', pedido?.phone ?? '—');
  check('la venta del local nace ENTREGADA', pedido?.status === 'ENTREGADO', pedido?.status ?? '—');
  check('marcó el stock como aplicado', pedido?.stockApplied === true);
  check('guardó la variante vendida', !!pedido?.items[0]?.variantId);

  const trasVenta = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  check('el stock real bajó de 9 a 7', trasVenta.stock === 7, String(trasVenta.stock));

  /* ------------------------- pasar a CANCELADO devuelve el stock, en la UI */
  await page.goto(`${BASE}/admin/pedidos`);
  await page.waitForSelector(`select[aria-label="Estado del pedido ${pedido!.id}"]`);
  await page.selectOption(`select[aria-label="Estado del pedido ${pedido!.id}"]`, 'CANCELADO');
  await page.waitForTimeout(2500);

  const trasCancelar = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  check('cancelar desde el panel devuelve el stock', trasCancelar.stock === 9, String(trasCancelar.stock));

  // Y volver a ENTREGADO lo descuenta otra vez, una sola vez.
  await page.selectOption(`select[aria-label="Estado del pedido ${pedido!.id}"]`, 'ENTREGADO');
  await page.waitForTimeout(2500);
  const trasReentregar = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  check('volver a entregar descuenta una sola vez', trasReentregar.stock === 7, String(trasReentregar.stock));

  /* --------------------------------- el teléfono se ve como link de WhatsApp */
  const waLink = page.locator(`a[href*="wa.me/2615558899"]`);
  check('el teléfono queda enlazado a WhatsApp', (await waLink.count()) > 0);

  await browser.close();

  /* ----------------------------------------------------------- limpieza */
  await prisma.order.deleteMany({ where: { customerName: 'Juana Pérez' } });
  await prisma.product.deleteMany({ where: { slug: 'ui-test-producto' } });
  await prisma.category.deleteMany({ where: { slug: 'ui-test' } });

  console.log(fallos === 0 ? '\n✅ La interfaz hace lo que tiene que hacer.\n' : `\n❌ ${fallos} comprobaciones fallaron.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
