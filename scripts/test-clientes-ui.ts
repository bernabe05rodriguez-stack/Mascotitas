/**
 * Prueba de la pantalla de Clientes.
 *
 *   npx tsx scripts/test-clientes-ui.ts [baseUrl]
 *
 * El registro de clientes se arma agrupando pedidos por teléfono. Lo que
 * importa: que dos compras del mismo número queden en UNA ficha con el total
 * sumado, y que el link de WhatsApp esté armado para poder escribirle.
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const prisma = new PrismaClient();

let fallos = 0;
function check(nombre: string, ok: boolean, extra = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '  ok  ' : ' FALLA'} ${nombre}${extra ? ` → ${extra}` : ''}`);
}

async function main() {
  const cat = await prisma.category.upsert({
    where: { slug: 'cli-test' },
    update: {},
    create: { slug: 'cli-test', name: 'Cli Test' },
  });
  await prisma.product.deleteMany({ where: { slug: 'cli-test-prod' } });
  const prod = await prisma.product.create({
    data: {
      slug: 'cli-test-prod',
      name: 'PRODUCTO CLIENTES',
      categoryId: cat.id,
      stock: 30,
      variants: { create: [{ label: '1KG', price: 1000, order: 0 }] },
    },
    include: { variants: true },
  });
  const v = prod.variants[0];

  const nuevoPedido = (total: number, phone: string, nombre: string) =>
    prisma.order.create({
      data: {
        status: 'ENTREGADO',
        channel: 'LOCAL',
        customerName: nombre,
        phone,
        subtotal: total,
        total,
        items: {
          create: {
            productId: prod.id,
            variantId: v.id,
            productName: prod.name,
            variantLabel: v.label,
            quantity: 1,
            unitPrice: total,
          },
        },
      },
    });

  // El mismo teléfono compra dos veces (con el nombre escrito distinto),
  // y otro cliente distinto una vez.
  await nuevoPedido(1500, '2617771111', 'carlos gomez');
  await nuevoPedido(2500, '2617771111', 'Carlos Gómez');
  await nuevoPedido(3000, '2617772222', 'Ana Ruiz');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE}/admin/login`);
  await page.fill('input[name="email"]', 'admin@test.local');
  await page.fill('input[name="password"]', 'Prueba1234');
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => /\/admin(\/|$)/.test(u.pathname) && !u.pathname.includes('login'), {
    timeout: 20000,
  });

  await page.goto(`${BASE}/admin/clientes`);
  await page.waitForSelector('table', { timeout: 15000 });

  // Hay un link en la barra lateral para llegar acá sin escribir la URL.
  const navLink = page.locator('nav a[href="/admin/clientes"]');
  check('la barra lateral tiene el link a Clientes', (await navLink.count()) > 0);

  const filaCarlos = page.locator('tr', { hasText: '2617771111' });
  check('el cliente repetido aparece una sola vez', (await filaCarlos.count()) === 1);

  const textoCarlos = (await filaCarlos.first().textContent()) ?? '';
  // Se mira la celda de "Pedidos" y no el texto de la fila entera: al
  // concatenarse las celdas, el "2" del contador queda pegado al teléfono y
  // cualquier búsqueda sobre el texto suelto da falsos resultados.
  const celdaPedidos = filaCarlos.first().locator('td').nth(2);
  check('junta los 2 pedidos del mismo teléfono', (await celdaPedidos.textContent())?.trim() === '2', (await celdaPedidos.textContent())?.trim() ?? '');
  check('suma lo gastado (1500 + 2500 = 4000)', textoCarlos.includes('4.000'), textoCarlos.trim().slice(0, 80));
  check('usa el nombre más reciente', textoCarlos.includes('Carlos Gómez'));

  const waCarlos = page.locator('a[href="https://wa.me/2617771111"]');
  check('link de WhatsApp armado', (await waCarlos.count()) > 0);

  const filaAna = page.locator('tr', { hasText: '2617772222' });
  check('el otro cliente también figura', (await filaAna.count()) === 1);
  check('Ana con su total', ((await filaAna.first().textContent()) ?? '').includes('3.000'));

  await browser.close();

  await prisma.order.deleteMany({ where: { phone: { in: ['2617771111', '2617772222'] } } });
  await prisma.product.deleteMany({ where: { slug: 'cli-test-prod' } });
  await prisma.category.deleteMany({ where: { slug: 'cli-test' } });

  console.log(fallos === 0 ? '\n✅ El registro de clientes funciona.\n' : `\n❌ ${fallos} fallaron.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
