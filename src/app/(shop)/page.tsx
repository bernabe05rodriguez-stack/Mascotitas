import Link from 'next/link';
import { Truck, ShieldCheck, MessagesSquare, Banknote, ArrowRight } from 'lucide-react';
import { Hero } from '@/components/shop/Hero';
import { ProductCard } from '@/components/shop/ProductCard';
import { CategoryTiles } from '@/components/shop/CategoryTiles';
import { getFeaturedProducts, getCatalog, getFilterOptions } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { scheduleLines } from '@/lib/horarios';

// Se renderiza por request: el build no tiene acceso a la base. Con 268
// productos contra un Postgres en el mismo servidor, la consulta no es el
// cuello de botella.
export const dynamic = 'force-dynamic';

const TRUST = [
  { icon: Truck, title: 'Envío en el día', text: 'En Mendoza capital y alrededores' },
  { icon: ShieldCheck, title: 'Primeras marcas', text: 'Royal Canin, Pro Plan, Old Prince' },
  { icon: MessagesSquare, title: 'Te asesoramos', text: 'Escribinos y te ayudamos a elegir' },
  { icon: Banknote, title: 'Efectivo y transferencia', text: 'Pagás cuando lo recibís' },
];

export default async function HomePage() {
  const [featured, newest, filters, settings] = await Promise.all([
    getFeaturedProducts(6),
    getCatalog({ sort: 'nuevos', perPage: 8 }),
    getFilterOptions(),
    getSettings(),
  ]);

  const schedule = scheduleLines(settings);

  return (
    <>
      <Hero featured={featured} settings={settings} />

      {/* Trust strip */}
      <section className="border-y border-line bg-white/50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:px-6 md:grid-cols-4 lg:px-8">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{ background: 'rgba(224,122,60,.08)', borderColor: 'rgba(224,122,60,.15)' }}
              >
                <Icon className="h-4 w-4 text-accent" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-navy">{title}</p>
                <p className="text-xs leading-snug text-navy/55">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categorías: el atajo que antes no existía */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <SectionHeading eyebrow="Categorías" title="¿Qué estás buscando?" />
        <CategoryTiles categories={filters.categories} />
      </section>

      {/* Novedades */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-24 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <SectionHeading eyebrow="Catálogo" title="Lo último que entró" className="mb-0" />
          <Link
            href="/catalogo"
            className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-accent transition hover:gap-2"
          >
            Ver todo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {newest.products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* Marcas */}
      {filters.brands.length > 0 && (
        <section className="border-t border-line bg-white/50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Marcas" title="Trabajamos con las que confiás" />
            <div className="flex flex-wrap gap-2">
              {filters.brands.slice(0, 24).map((b) => (
                <Link
                  key={b.slug}
                  href={`/catalogo?brand=${b.slug}`}
                  className="chip chip-idle"
                >
                  {b.name}
                  <span className="ml-1.5 text-xs text-navy/40 tabular">{b._count.products}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Horarios */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-line bg-white p-8 shadow-card md:p-12">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <SectionHeading eyebrow="Visitanos" title="Estamos en Dorrego" />
              <p className="text-navy/70">
                {settings.address}, {settings.city}. Retirás por el local o te lo llevamos.
              </p>
              <a
                href={`https://wa.me/${settings.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold"
              >
                Hacer un pedido
              </a>
            </div>
            <dl className="space-y-3 md:border-l md:border-line md:pl-8">
              {schedule.map((s) => (
                <div key={s.days}>
                  <dt className="text-sm font-semibold text-navy">{s.days}</dt>
                  <dd className="text-sm text-navy/60 tabular">{s.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  className = '',
}: {
  eyebrow: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="mb-2 flex items-center gap-3">
        <span className="h-px w-6 bg-accent/40" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</span>
      </div>
      <h2 className="text-3xl font-extrabold text-navy md:text-4xl">{title}</h2>
    </div>
  );
}
