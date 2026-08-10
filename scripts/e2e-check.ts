/**
 * Verificación end-to-end de los caminos que importan.
 *
 * No es una suite de tests: es el chequeo que se corre antes de deployar para
 * confirmar que la tienda vende y que el panel no quedó abierto.
 *
 *   npx tsx scripts/e2e-check.ts [baseUrl]
 */
import { chromium, type Browser, type Page } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@mascotitas.online';
const PASSWORD = process.env.E2E_PASSWORD ?? 'devpassword123';

let passed = 0;
const failures: string[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}\n      ${(err as Error).message}`);
    failures.push(name);
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const browser: Browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page: Page = await ctx.newPage();

  console.log(`\n=== Verificación end-to-end contra ${BASE} ===\n`);

  console.log('TIENDA');

  await check('la home carga y muestra productos', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('article').first().waitFor({ timeout: 20_000 });
    const cards = await page.locator('article').count();
    assert(cards > 0, 'no se renderizó ninguna card');
  });

  await check('el catálogo lista los 268 productos', async () => {
    await page.goto(`${BASE}/catalogo`, { waitUntil: 'domcontentloaded' });
    await page.locator('article').first().waitFor({ timeout: 20_000 });
    const text = await page.locator('body').innerText();
    assert(/268\s*productos/.test(text), `no aparece el conteo 268 (vi: ${text.slice(0, 120)})`);
  });

  await check('el filtro por marca acota los resultados', async () => {
    await page.goto(`${BASE}/catalogo?brand=old-prince`, { waitUntil: 'domcontentloaded' });
    await page.locator('article').first().waitFor({ timeout: 20_000 });
    const text = await page.locator('body').innerText();
    assert(/\b16\s*productos/.test(text), 'Old Prince debería traer 16 productos');
  });

  await check('la búsqueda con dos palabras exige ambas', async () => {
    await page.goto(`${BASE}/catalogo?q=old+prince+gato`, { waitUntil: 'domcontentloaded' });
    // Cada card tiene dos links al producto (la foto y el nombre); el de la
    // foto no tiene texto, así que se descarta.
    await page.locator('article').first().waitFor({ timeout: 20_000 });
    const names = (await page.locator('article a[href^="/producto/"]').allInnerTexts())
      .map((t) => t.trim())
      .filter(Boolean);
    assert(names.length > 0, 'la búsqueda no trajo nada');
    assert(
      names.every((n) => /old/i.test(n) && /prince/i.test(n) && /gat/i.test(n)),
      `algún resultado no tiene los tres términos: ${names.join(' | ')}`,
    );
  });

  await check('la ficha de producto abre y tiene JSON-LD de Product', async () => {
    await page.goto(`${BASE}/producto/catchow-adulto-carne`, { waitUntil: 'domcontentloaded' });
    const ld = await page.locator('script[type="application/ld+json"]').first().innerText();
    const parsed = JSON.parse(ld);
    assert(parsed['@type'] === 'Product', 'el JSON-LD no es de tipo Product');
    assert(Array.isArray(parsed.offers) && parsed.offers.length > 0, 'el JSON-LD no tiene ofertas con precio');
  });

  await check('agregar al carrito y que sobreviva al refresh', async () => {
    await page.goto(`${BASE}/producto/catchow-adulto-carne`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /agregar al carrito/i }).click();
    await page.waitForTimeout(600);

    await page.reload({ waitUntil: 'domcontentloaded' });
    const badge = await page.locator('#nav-cart span').first().innerText();
    assert(badge.trim() === '1', `el carrito perdió el producto al refrescar (badge: "${badge}")`);
  });

  await check('el cupón inválido se rechaza', async () => {
    const res = await page.request.post(`${BASE}/api/coupons/validate`, {
      data: { code: 'NOEXISTE', subtotal: 50000 },
    });
    const body = await res.json();
    assert(body.valid === false, 'aceptó un cupón inexistente');
  });

  await check('el cupón real se acepta con su porcentaje', async () => {
    const res = await page.request.post(`${BASE}/api/coupons/validate`, {
      data: { code: 'MAVERIX', subtotal: 50000 },
    });
    const body = await res.json();
    assert(body.valid === true && body.percent === 10, `MAVERIX no validó bien: ${JSON.stringify(body)}`);
  });

  await check('el precio del pedido lo pone el servidor, no el cliente', async () => {
    // Se busca una variante real y se intenta pedirla mintiendo el precio.
    await page.goto(`${BASE}/producto/catchow-adulto-carne`);
    const res = await page.request.post(`${BASE}/api/orders`, {
      data: {
        customerName: 'Test E2E',
        items: [{ variantId: 'no-existe', quantity: 1, unitPrice: 1 }],
      },
    });
    assert(res.status() === 400, `debería rechazar variantes inexistentes, devolvió ${res.status()}`);
  });

  console.log('\nPANEL');

  await check('el panel redirige al login sin sesión', async () => {
    const res = await ctx.request.get(`${BASE}/admin/productos`, { maxRedirects: 0 });
    assert(res.status() === 307 || res.status() === 302, `esperaba redirect, devolvió ${res.status()}`);
  });

  await check('la subida de imágenes rechaza a los no autenticados', async () => {
    // Esta es la lección de Guchini: el middleware NO cubre /api/*.
    const fresh = await browser.newContext();
    const res = await fresh.request.post(`${BASE}/api/admin/upload`, {
      multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50]) } },
    });
    await fresh.close();
    assert(res.status() === 401, `la ruta de upload quedó abierta: devolvió ${res.status()}`);
  });

  await check('se puede entrar al panel', async () => {
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/admin$/, { timeout: 15000 });
    const text = await page.locator('body').innerText();
    assert(/Resumen/.test(text), 'no cargó el resumen del panel');
  });

  await check('la tabla de productos carga', async () => {
    await page.goto(`${BASE}/admin/productos`, { waitUntil: 'domcontentloaded' });
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });
    const rows = await page.locator('tbody tr').count();
    assert(rows > 10, `esperaba varias filas, encontré ${rows}`);
  });

  await check('editar un precio en la tabla lo guarda de verdad', async () => {
    await page.goto(`${BASE}/admin/productos?q=catchow+adulto+carne`, { waitUntil: 'domcontentloaded' });
    await page.locator('tbody tr').first().waitFor({ timeout: 20_000 });

    const priceInput = page.locator('tbody tr').first().locator('input[type="number"]').first();
    const original = await priceInput.inputValue();
    const nuevo = String(Number(original) + 1234);

    await priceInput.fill(nuevo);
    await page.getByRole('button', { name: /guardar/i }).first().click();
    await page.waitForTimeout(2500);

    await page.reload({ waitUntil: 'domcontentloaded' });
    const after = await page.locator('tbody tr').first().locator('input[type="number"]').first().inputValue();
    assert(after === nuevo, `el precio no persistió: esperaba ${nuevo}, quedó ${after}`);

    // Se deja como estaba, para no ensuciar el catálogo.
    await page.locator('tbody tr').first().locator('input[type="number"]').first().fill(original);
    await page.getByRole('button', { name: /guardar/i }).first().click();
    await page.waitForTimeout(2000);
  });

  await check('el cambio del panel se ve en la tienda', async () => {
    await page.goto(`${BASE}/producto/catchow-adulto-carne`, { waitUntil: 'domcontentloaded' });
    const text = await page.locator('body').innerText();
    assert(/\$\s?53\.000/.test(text), `el precio restaurado no se refleja en la tienda: ${text.slice(0, 200)}`);
  });

  await browser.close();

  console.log(`\n=== ${passed} OK, ${failures.length} fallando ===`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
