import Link from 'next/link';
import { Clock, MapPin, Phone } from 'lucide-react';
import type { ShopSettings } from '@/lib/settings';
import { scheduleLines } from '@/lib/horarios';

export function Footer({ settings }: { settings: ShopSettings }) {
  const schedule = scheduleLines(settings);

  return (
    <footer className="relative mt-10 overflow-hidden py-16 text-white" style={{ background: '#16314a' }}>
      {/* Hairline sutil arriba, en vez de la franja dorada gruesa de antes. */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(232,168,124,.5), transparent)' }}
        aria-hidden
      />

      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <h3 className="text-2xl font-extrabold">Mascotitas</h3>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
            Alimento balanceado y accesorios para perros y gatos en {settings.city}. Envío en el día.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <a
              href={settings.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-white transition hover:scale-110 hover:text-[#1877F2]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.313 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
              </svg>
            </a>
            <a
              href={settings.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-white transition hover:scale-110 hover:text-[#E4405F]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
            <a
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-whatsapp px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
            >
              <Phone className="h-4 w-4" /> Escribinos
            </a>
          </div>
        </div>

        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-white/90">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15"
              style={{ background: 'rgba(232,168,124,.15)' }}
            >
              <Clock className="h-3.5 w-3.5" style={{ color: '#E8A87C' }} />
            </span>
            Horarios
          </h4>
          <dl className="mt-4 space-y-2 text-sm">
            {schedule.map((s) => (
              <div key={s.days}>
                <dt className="font-medium text-white/90">{s.days}</dt>
                <dd className="text-white/60 tabular">{s.hours}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/90">Dónde estamos</h4>
          <p className="mt-4 flex items-start gap-2 text-sm text-white/70">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#E8A87C' }} />
            {settings.address}, {settings.city}
          </p>
          <nav className="mt-5 flex flex-col gap-2 text-sm">
            <Link href="/catalogo" className="text-white/70 transition hover:text-white">
              Catálogo completo
            </Link>
            <Link href="/catalogo?pet=perro" className="text-white/70 transition hover:text-white">
              Todo para perros
            </Link>
            <Link href="/catalogo?pet=gato" className="text-white/70 transition hover:text-white">
              Todo para gatos
            </Link>
          </nav>
        </div>
      </div>

      <p className="mx-auto mt-12 max-w-7xl px-4 text-xs text-white/50 sm:px-6 lg:px-8">
        © {new Date().getFullYear()} Mascotitas — Alimento para mascotas en {settings.city}
      </p>
    </footer>
  );
}
