'use client';

import { useState } from 'react';
import { ChevronDown, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/format';

/**
 * La fila original del Google Sheet, tal cual estaba el día de la migración.
 *
 * Se guarda para que la promesa de "no perder nada" sea verificable: si algo
 * quedó mal normalizado, acá está el dato crudo para compararlo.
 */
export function LegacyRawPanel({ raw }: { raw: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(raw).filter(([, v]) => String(v ?? '').trim() !== '');

  return (
    <section className="rounded-2xl border border-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-navy">
          <FileSpreadsheet className="h-4 w-4 text-navy/40" />
          Datos originales de la planilla
        </span>
        <ChevronDown className={cn('h-4 w-4 text-navy/40 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-line px-5 py-4">
          <p className="mb-3 text-xs text-navy/50">
            Así estaba esta fila en el Google Sheet cuando se migró. Es solo lectura: sirve de respaldo por si hay que
            comparar algo.
          </p>
          <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            {entries.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line/60 py-1">
                <dt className="shrink-0 font-medium text-navy/50">{k}</dt>
                <dd className="truncate text-right text-navy/80">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
