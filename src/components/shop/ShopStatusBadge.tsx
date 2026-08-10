'use client';

import { useEffect, useState } from 'react';
import { getShopStatus, type ShopStatus } from '@/lib/horarios';
import type { ShopSettings } from '@/lib/settings';
import { cn } from '@/lib/format';

/**
 * El estado se calcula en el servidor para el primer render (así no parpadea ni
 * queda mal en el HTML que ve Google) y se refresca cada minuto en el cliente.
 */
export function ShopStatusBadge({ initial, settings }: { initial: ShopStatus; settings: ShopSettings }) {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    const tick = () => setStatus(getShopStatus(settings));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [settings]);

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy backdrop-blur-md"
      title={status.detail}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', status.open ? 'bg-green-500' : 'bg-red-500')}
        aria-hidden
      />
      {status.label} · {settings.city}
    </span>
  );
}
