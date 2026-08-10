import Link from 'next/link';
import {
  Dog,
  Cat,
  Soup,
  Rabbit,
  Bone,
  BedDouble,
  Shirt,
  ShieldCheck,
  PawPrint,
  type LucideIcon,
} from 'lucide-react';

/**
 * Sólo se muestran las categorías de primer nivel. Las subcategorías de
 * Accesorios (juguetes, sanitarios, etc.) viven adentro del filtro del catálogo.
 */
const ICONS: Record<string, LucideIcon> = {
  dog: Dog,
  cat: Cat,
  soup: Soup,
  rabbit: Rabbit,
  bone: Bone,
  'bed-double': BedDouble,
  shirt: Shirt,
  'shield-check': ShieldCheck,
};

interface CategoryLike {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  _count: { products: number };
}

export function CategoryTiles({ categories }: { categories: CategoryLike[] }) {
  const tops = categories.filter((c) => !c.parentId);

  // Una categoría padre suma también lo de sus hijas: Accesorios muestra 79, no 0.
  const countFor = (c: CategoryLike) =>
    c._count.products + categories.filter((k) => k.parentId === c.id).reduce((n, k) => n + k._count.products, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {tops.map((c) => {
        const Icon = ICONS[c.icon ?? ''] ?? PawPrint;
        const total = countFor(c);
        return (
          <Link
            key={c.id}
            href={`/catalogo?category=${c.slug}`}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-all hover:-translate-y-1 hover:border-accent/30 hover:shadow-card-hover"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors"
              style={{ background: 'rgba(224,122,60,.08)', borderColor: 'rgba(224,122,60,.15)' }}
            >
              <Icon className="h-5 w-5 text-accent" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-navy transition-colors group-hover:text-accent">
                {c.name}
              </span>
              <span className="text-xs text-navy/50 tabular">
                {total} {total === 1 ? 'producto' : 'productos'}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
