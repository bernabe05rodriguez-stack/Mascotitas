import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatPrice(pesos: number): string {
  return ARS.format(pesos);
}

/** "-25%" para el badge de oferta. */
export function discountPercent(price: number, originalPrice: number): number {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

export function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));
}

/**
 * Los nombres vienen del Sheet TODOS EN MAYÚSCULA, que a este tamaño y en
 * Fraunces se lee como si el sitio te gritara. Se capitalizan sólo para mostrar
 * — en la base y en el panel el nombre sigue siendo el que se cargó.
 *
 * Los tokens con números se dejan como están: "3KG", "55X45CM", "P46", "X3"
 * pierden sentido si se los toca.
 */
export function displayName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((token) => {
      if (/\d/.test(token)) return token;
      // Capitaliza cada tramo alfabético, para que "MED/GR" quede "Med/Gr".
      return token.toLowerCase().replace(/(^|[^a-záéíóúüñ])([a-záéíóúüñ])/gi, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(' ');
}

/** Precio mínimo visible de un producto, ya con descuento aplicado. */
export function priceRange(variants: { price: number; originalPrice: number | null }[]) {
  const prices = variants.map((v) => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const cheapest = variants.find((v) => v.price === min);
  return { min, max, hasRange: min !== max, originalPrice: cheapest?.originalPrice ?? null };
}
