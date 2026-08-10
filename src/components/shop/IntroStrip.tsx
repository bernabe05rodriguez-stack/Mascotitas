import Link from 'next/link';
import { Star, Truck } from 'lucide-react';
import { getShopStatus } from '@/lib/horarios';
import type { ShopSettings } from '@/lib/settings';
import { ShopStatusBadge } from './ShopStatusBadge';

/**
 * Banda de presentación, debajo del carrusel.
 *
 * Antes esto era un hero de media pantalla. Al pasar los destacados a un
 * carrusel grande arriba de todo, la propuesta de valor pasa a ocupar una
 * franja compacta: sigue estando el h1 (que es el que lee Google) pero sin
 * empujar el catálogo hacia abajo.
 */
export function IntroStrip({ settings }: { settings: ShopSettings }) {
  const status = getShopStatus(settings);

  return (
    <section className="border-b border-line bg-white/60">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-10 text-center sm:px-6 md:flex-row md:justify-between md:gap-10 md:text-left lg:px-8">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <ShopStatusBadge initial={status} settings={settings} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-dark">
              <Truck className="h-3 w-3" /> Envío en el día
            </span>
          </div>

          <h1 className="text-2xl font-extrabold leading-tight text-navy sm:text-3xl lg:text-4xl">
            Tu mascota <em className="not-italic text-accent">merece lo mejor</em>
          </h1>

          <p className="mt-2 max-w-xl text-sm text-navy/70 sm:text-base" style={{ textWrap: 'pretty' }}>
            Alimento balanceado, accesorios y camas para perros y gatos. Las mejores marcas, al mejor precio, con
            entrega en el día en {settings.city}.
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-navy/60 md:justify-start">
            <span className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-gold text-gold" />
              ))}
            </span>
            <span className="font-medium">+500 mascotas felices</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-center gap-3">
          <Link href="/catalogo" className="btn-primary btn-shine rounded-full px-7 py-3.5 text-base font-semibold">
            Ver catálogo
          </Link>
          <a
            href={`https://wa.me/${settings.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline rounded-full px-7 py-3.5 text-base font-semibold"
          >
            Escribinos
          </a>
        </div>
      </div>
    </section>
  );
}
