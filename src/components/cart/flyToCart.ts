import { DOG_FLY_SVG, CAT_FLY_SVG } from './flyIcons';

/**
 * El perrito (o gatito) que sale del botón "+" y vuela en arco hasta el
 * carrito, con líneas de olfateo y un estallido al llegar.
 *
 * Se maneja con DOM directo a propósito: son nodos efímeros de 3 segundos que
 * no participan del árbol de React ni de ningún estado.
 */

const FLIGHT_MS = 2600;
const ARC_HEIGHT = 140;
const SIZE = 64;

export function flyToCart(origin: HTMLElement, opts: { isCat?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    spawnCartBurst();
    return;
  }

  const cartEl = document.getElementById('nav-cart');
  if (!cartEl) return;

  const from = origin.getBoundingClientRect();
  const to = cartEl.getBoundingClientRect();

  const startX = from.left + from.width / 2 - SIZE / 2;
  const startY = from.top + from.height / 2 - SIZE / 2;
  const endX = to.left + to.width / 2 - SIZE / 2;
  const endY = to.top + to.height / 2 - SIZE / 2;

  const flyer = document.createElement('div');
  flyer.className = 'doggo-fly doggo-bounce';
  flyer.innerHTML = opts.isCat ? CAT_FLY_SVG : DOG_FLY_SVG;
  flyer.style.left = `${startX}px`;
  flyer.style.top = `${startY}px`;
  flyer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(flyer);

  const sniff = spawnSniffLines(startX + SIZE / 2, startY);

  // Fase 1: sube en arco. Fase 2: baja al carrito y se achica.
  requestAnimationFrame(() => {
    flyer.style.transform = `translate(${(endX - startX) / 2}px, ${(endY - startY) / 2 - ARC_HEIGHT}px) scale(1)`;
  });

  window.setTimeout(() => {
    flyer.classList.remove('doggo-bounce');
    flyer.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(.5)`;
    flyer.style.opacity = '0';
  }, FLIGHT_MS * 0.85);

  window.setTimeout(() => {
    flyer.remove();
    sniff.forEach((el) => el.remove());
    spawnCartBurst();
  }, FLIGHT_MS + 700);
}

function spawnSniffLines(x: number, y: number): HTMLElement[] {
  return [0, 1, 2].map((i) => {
    const line = document.createElement('div');
    line.textContent = '~';
    line.setAttribute('aria-hidden', 'true');
    line.style.cssText = `position:fixed;z-index:9998;pointer-events:none;left:${x + 18 + i * 10}px;top:${
      y - 6
    }px;font-size:26px;color:rgba(27,60,89,.35);font-weight:700;transition:opacity 1.5s ease, transform 1.5s ease;`;
    document.body.appendChild(line);
    requestAnimationFrame(() => {
      line.style.opacity = '0';
      line.style.transform = `translate(${12 + i * 6}px, -22px)`;
    });
    return line;
  });
}

/** Estallido coral + anillo + sacudida del ícono del carrito. */
export function spawnCartBurst(): void {
  const cartEl = document.getElementById('nav-cart');
  if (!cartEl) return;

  const rect = cartEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  const burst = document.createElement('div');
  burst.className = 'cart-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.style.cssText += `left:${x}px;top:${y}px;width:130px;height:130px;`;
  document.body.appendChild(burst);

  const ring = document.createElement('div');
  ring.className = 'cart-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText += `left:${x}px;top:${y}px;width:60px;height:60px;`;
  document.body.appendChild(ring);

  const icon = cartEl.querySelector('svg');
  icon?.classList.add('cart-shake');

  window.setTimeout(() => {
    burst.remove();
    ring.remove();
    icon?.classList.remove('cart-shake');
  }, 1500);
}
