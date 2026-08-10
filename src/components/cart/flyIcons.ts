/**
 * Los animalitos que vuelan al carrito al agregar un producto.
 *
 * Son SVG ilustrados propios, no emoji: los emoji dependen de la fuente del
 * sistema y se veían distintos (o rotos) en cada OS. Con esto el render es
 * idéntico en todos lados, y el lenguaje visual matchea el del logo.
 */

export const DOG_FLY_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g fill="white" stroke="white" stroke-width="4" stroke-linejoin="round"><ellipse cx="14" cy="26" rx="9" ry="14" transform="rotate(18 14 26)"/><ellipse cx="50" cy="26" rx="9" ry="14" transform="rotate(-18 50 26)"/><circle cx="32" cy="32" r="22"/></g><ellipse cx="14" cy="26" rx="9" ry="14" fill="#8B5A3C" transform="rotate(18 14 26)"/><ellipse cx="50" cy="26" rx="9" ry="14" fill="#8B5A3C" transform="rotate(-18 50 26)"/><circle cx="32" cy="32" r="22" fill="#D9A066"/><path d="M43 12 a22 22 0 0 1 10 13 l-13 1.5 z" fill="#8B5A3C" opacity=".9"/><ellipse cx="32" cy="41" rx="12" ry="9" fill="#F3D9B8"/><circle cx="24" cy="28" r="3.2" fill="#27221E"/><circle cx="40" cy="28" r="3.2" fill="#27221E"/><circle cx="25.2" cy="26.8" r="1.1" fill="#fff"/><circle cx="41.2" cy="26.8" r="1.1" fill="#fff"/><ellipse cx="32" cy="37.5" rx="4" ry="3" fill="#3A2C23"/><path d="M32 40.5 q0 3.5 -4.5 3.5 M32 40.5 q0 3.5 4.5 3.5" stroke="#3A2C23" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M28.5 44 q3.5 7 7 0 v-1 h-7 z" fill="#E8836F"/><ellipse cx="16.5" cy="36" rx="3.5" ry="2" fill="#E8836F" opacity=".4"/><ellipse cx="47.5" cy="36" rx="3.5" ry="2" fill="#E8836F" opacity=".4"/></svg>`;

export const CAT_FLY_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g fill="white" stroke="white" stroke-width="4" stroke-linejoin="round"><path d="M13 27 L9 8 L27 16 z"/><path d="M51 27 L55 8 L37 16 z"/><ellipse cx="32" cy="35" rx="21" ry="19"/></g><path d="M13 27 L9 8 L27 16 z" fill="#E89B53"/><path d="M51 27 L55 8 L37 16 z" fill="#E89B53"/><path d="M15 22.5 L12.8 12 L23.5 16.8 z" fill="#F5C9A0"/><path d="M49 22.5 L51.2 12 L40.5 16.8 z" fill="#F5C9A0"/><ellipse cx="32" cy="35" rx="21" ry="19" fill="#F0A95E"/><path d="M32 17 v5.5 M24.5 18 l1.8 5 M39.5 18 l-1.8 5" stroke="#C97B33" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="23.5" cy="33" r="3.2" fill="#27221E"/><circle cx="40.5" cy="33" r="3.2" fill="#27221E"/><circle cx="24.7" cy="31.8" r="1.1" fill="#fff"/><circle cx="41.7" cy="31.8" r="1.1" fill="#fff"/><path d="M29.8 38.5 h4.4 l-2.2 2.8 z" fill="#E8836F"/><path d="M32 41.3 q0 2.8 -4 2.8 M32 41.3 q0 2.8 4 2.8" stroke="#3A2C23" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M13.5 36.5 H5.5 M14.5 41 l-7.5 2.5 M50.5 36.5 H58.5 M49.5 41 l7.5 2.5" stroke="#3A2C23" stroke-width="1.4" stroke-linecap="round" opacity=".7"/><ellipse cx="17" cy="41" rx="3.2" ry="1.8" fill="#E8836F" opacity=".4"/><ellipse cx="47" cy="41" rx="3.2" ry="1.8" fill="#E8836F" opacity=".4"/></svg>`;

/**
 * Los productos felinos tienen que mandar el gatito. La categoría sola no
 * alcanza: hay comida de gato dentro de "alimentos húmedos", así que también se
 * mira el nombre y la marca.
 */
export function isCatProduct(name: string, categorySlug?: string | null, petType?: string | null): boolean {
  if (petType === 'GATO') return true;
  if (categorySlug === 'gato') return true;
  return /catchow|catpro|catfe|whiskas|felin|gatito|gato|katze|michi/i.test(name);
}
