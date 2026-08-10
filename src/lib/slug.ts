/**
 * Slug estable y legible. Es la URL pública del producto (/producto/{slug}),
 * así que una vez publicado conviene no cambiarlo: se rompen los links que ya
 * indexó Google y los que la gente compartió por WhatsApp.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
