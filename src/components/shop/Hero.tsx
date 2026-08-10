import Link from 'next/link';
import { Star, Truck } from 'lucide-react';
import type { ProductCard } from '@/lib/catalog';
import { getShopStatus } from '@/lib/horarios';
import type { ShopSettings } from '@/lib/settings';
import { FeaturedCarousel } from './FeaturedCarousel';
import { ShopStatusBadge } from './ShopStatusBadge';

export function Hero({ featured, settings }: { featured: ProductCard[]; settings: ShopSettings }) {
  const status = getShopStatus(settings);

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(120% 80% at 50% 0%, #EFEADD 0%, #F6F4EF 45%, #F9F7F2 100%)' }}
      />
      <div className="blob animate-blob" style={{ width: 440, height: 440, background: '#E8A87C', top: -140, left: -140, opacity: 0.28 }} />
      <div className="blob animate-blob-slow" style={{ width: 400, height: 400, background: '#1B3C59', bottom: -160, right: -120, opacity: 0.12 }} />

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-28 lg:px-8">
        <div className="reveal in">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <ShopStatusBadge initial={status} settings={settings} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-dark">
              <Truck className="h-3 w-3" /> Envío en el día
            </span>
          </div>

          <h1 className="text-4xl font-extrabold leading-[1.05] text-navy sm:text-5xl lg:text-6xl">
            Tu mascota <em className="not-italic text-accent">merece lo mejor</em>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-navy/70 sm:text-lg" style={{ textWrap: 'pretty' }}>
            Alimento balanceado, accesorios y camas para perros y gatos. Las mejores marcas, al mejor precio, con
            entrega en el día en {settings.city}.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/catalogo" className="btn-primary btn-shine rounded-full px-7 py-3.5 text-base font-semibold">
              Ver catálogo
            </Link>
            <a
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline rounded-full px-7 py-3.5 text-base font-semibold"
            >
              Escribinos por WhatsApp
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-navy/60">
            <span className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-gold text-gold" />
              ))}
            </span>
            <span className="font-medium">+500 mascotas felices</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 scale-110 rounded-full bg-navy opacity-10 blur-3xl" aria-hidden />
          <div className="relative mx-auto w-full max-w-md md:max-w-lg">
            <FeaturedCarousel products={featured} />
          </div>
        </div>
      </div>
    </section>
  );
}
