/**
 * Auditoría de legibilidad y layout en distintos tamaños de pantalla.
 *
 * Mide en vez de mirar: desborde horizontal, elementos que se salen del ancho,
 * texto por debajo del mínimo legible, y botones/links demasiado chicos para
 * el dedo. Recorre la tienda y el panel.
 *
 *   npx tsx scripts/responsive-audit.ts [baseUrl]
 */
import { chromium, type Page } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const EMAIL = process.env.E2E_EMAIL ?? 'admin@mascotitas.online';
const PASSWORD = process.env.E2E_PASSWORD ?? 'devpassword123';

// 360 es el ancho real de los Android más comunes en Argentina; si entra ahí,
// entra en todos.
const VIEWPORTS = [
  { w: 360, h: 780, name: 'mobile-chico' },
  { w: 390, h: 844, name: 'mobile' },
  { w: 768, h: 1024, name: 'tablet' },
  { w: 1440, h: 900, name: 'desktop' },
];

const PAGES = [
  { path: '/', name: 'home', admin: false },
  { path: '/catalogo', name: 'catálogo', admin: false },
  { path: '/producto/catchow-adulto-carne', name: 'ficha', admin: false },
  { path: '/admin', name: 'panel: resumen', admin: true },
  { path: '/admin/productos', name: 'panel: productos', admin: true },
  { path: '/admin/pedidos', name: 'panel: pedidos', admin: true },
  { path: '/admin/cupones', name: 'panel: cupones', admin: true },
  { path: '/admin/categorias', name: 'panel: categorías', admin: true },
  { path: '/admin/config', name: 'panel: configuración', admin: true },
];

const MIN_FONT = 12; // px
const MIN_TAP = 40; // px — el mínimo cómodo para el dedo

interface Problema {
  vista: string;
  viewport: string;
  tipo: string;
  detalle: string;
}

async function auditar(page: Page, vista: string, viewport: string): Promise<Problema[]> {
  return page.evaluate(
    ({ vista, viewport, MIN_FONT, MIN_TAP }) => {
      const out: { vista: string; viewport: string; tipo: string; detalle: string }[] = [];
      const vw = document.documentElement.clientWidth;

      const overflow = document.documentElement.scrollWidth - vw;
      if (overflow > 1) {
        out.push({ vista, viewport, tipo: 'desborde-pagina', detalle: `${overflow}px de scroll horizontal` });
      }

      const describir = (el: Element) => {
        const tag = el.tagName.toLowerCase();
        const cls = (el.getAttribute('class') ?? '').split(/\s+/).slice(0, 3).join('.');
        const txt = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32);
        return `${tag}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`;
      };

      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
      };

      // Un contenedor que scrollea o recorta a propósito (la tabla del panel,
      // los chips de categorías) hace que sus hijos sean legítimamente más
      // anchos que la pantalla. Sólo interesa lo que se sale sin querer.
      const recortadoPorAncestro = (el: Element) => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
          p = p.parentElement;
        }
        return false;
      };

      // Sólo se reporta lo que NO entra en la pantalla: más ancho que el
      // viewport. Que un elemento esté corrido fuera de vista (el carrito
      // cerrado, por ejemplo) no es un problema de layout.
      const reportados = new Set<string>();
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= vw + 2) continue;
        if (recortadoPorAncestro(el)) continue;
        const d = describir(el);
        if (reportados.has(d)) continue;
        reportados.add(d);
        out.push({ vista, viewport, tipo: 'elemento-desbordado', detalle: `${d} — ${Math.round(r.width)}px en ${vw}px` });
      }

      // Texto ilegible
      const chicos = new Map<string, number>();
      for (const el of Array.from(document.querySelectorAll('p,span,a,li,td,th,label,button,h1,h2,h3,h4,div'))) {
        if (!visible(el)) continue;
        const propio = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
        if (!propio) continue;
        const st = getComputedStyle(el);
        const size = parseFloat(st.fontSize);
        // Las etiquetas en mayúscula con tracking amplio (marcas, "CATÁLOGO")
        // se leen bien a 11px y son una decisión tipográfica deliberada. Lo que
        // no puede bajar de 12px es el texto corrido.
        const esEtiqueta = st.textTransform === 'uppercase' && parseFloat(st.letterSpacing) >= 1;
        if (size < MIN_FONT && !esEtiqueta) {
          const k = `${Math.round(size * 10) / 10}px`;
          chicos.set(k, (chicos.get(k) ?? 0) + 1);
        }
      }
      for (const [size, n] of chicos) {
        out.push({ vista, viewport, tipo: 'texto-chico', detalle: `${n} elemento(s) a ${size}` });
      }

      // Zonas táctiles chicas (sólo importa en pantallas de dedo)
      if (vw <= 820) {
        const chicas = new Set<string>();
        for (const el of Array.from(document.querySelectorAll('button,select,input[type=checkbox],a'))) {
          if (!visible(el)) continue;
          // Un link dentro de un párrafo no necesita 44px; un botón sí. Se
          // consideran controles los que tienen fondo, borde o son <button>.
          const st = getComputedStyle(el);
          const esControl =
            el.tagName !== 'A' ||
            (st.backgroundColor !== 'rgba(0, 0, 0, 0)' && st.backgroundColor !== 'transparent') ||
            parseFloat(st.borderTopWidth) > 0;
          if (!esControl) continue;
          const r = el.getBoundingClientRect();
          if (r.width < MIN_TAP || r.height < MIN_TAP) chicas.add(`${describir(el)} (${Math.round(r.width)}×${Math.round(r.height)})`);
        }
        for (const d of Array.from(chicas).slice(0, 6)) {
          out.push({ vista, viewport, tipo: 'tap-chico', detalle: d });
        }
      }

      return out;
    },
    { vista, viewport, MIN_FONT, MIN_TAP },
  );
}

async function main() {
  const browser = await chromium.launch();
  const problemas: Problema[] = [];

  console.log(`\n=== Auditoría responsive contra ${BASE} ===\n`);

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    // Sesión del panel, una vez por viewport
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL(/\/admin$/, { timeout: 20_000 }).catch(() => {});

    for (const pg of PAGES) {
      await page.goto(`${BASE}${pg.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1800);
      const found = await auditar(page, pg.name, `${vp.w}px`);
      problemas.push(...found);
    }

    // El carrito abierto es una vista propia y se le suele escapar a las pruebas
    await page.goto(`${BASE}/producto/catchow-adulto-carne`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /agregar al carrito/i }).click();
    await page.waitForTimeout(1200);
    await page.locator('#nav-cart').click();
    await page.waitForTimeout(1200);
    problemas.push(...(await auditar(page, 'carrito abierto', `${vp.w}px`)));

    await ctx.close();
  }

  await browser.close();

  if (problemas.length === 0) {
    console.log('  ✓ Sin problemas de layout ni legibilidad.\n');
    return;
  }

  const porTipo = new Map<string, Problema[]>();
  for (const p of problemas) {
    if (!porTipo.has(p.tipo)) porTipo.set(p.tipo, []);
    porTipo.get(p.tipo)!.push(p);
  }

  for (const [tipo, lista] of porTipo) {
    console.log(`--- ${tipo} (${lista.length}) ---`);
    const vistos = new Set<string>();
    for (const p of lista) {
      const k = `${p.vista}|${p.detalle}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      console.log(`  [${p.viewport.padStart(6)}] ${p.vista}: ${p.detalle}`);
    }
    console.log('');
  }

  console.log(`Total: ${problemas.length} observaciones\n`);
  process.exitCode = porTipo.has('desborde-pagina') || porTipo.has('elemento-desbordado') ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
