'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/format';

/** Botón flotante con el globo que asoma cada tanto, igual que en el sitio viejo. */
export function WhatsAppFab({ whatsapp }: { whatsapp: string }) {
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    const pop = () => {
      setShowTip(true);
      timers.push(window.setTimeout(() => setShowTip(false), 4000));
    };
    timers.push(window.setTimeout(pop, 5000));
    const id = window.setInterval(pop, 30_000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(id);
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      <div
        className={cn(
          'rounded-2xl border border-line bg-white px-4 py-2 text-sm font-medium text-navy shadow-lg transition-all duration-300',
          showTip ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
        aria-hidden={!showTip}
      >
        🐾 ¿No encontrás el alimento? Escribinos
      </div>

      <a
        href={`https://wa.me/${whatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribinos por WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-[0_10px_28px_-8px_rgba(37,211,102,.7)] transition hover:scale-110"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.93 11.93 0 005.71 1.454h.006c6.585 0 11.946-5.359 11.949-11.945a11.86 11.86 0 00-3.480-8.408" />
        </svg>
      </a>
    </div>
  );
}
