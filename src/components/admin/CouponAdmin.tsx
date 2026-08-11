'use client';

import { useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Loader2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { saveCouponAction, toggleCouponAction, deleteCouponAction, type ActionResult } from '@/app/admin/actions';
import { cn } from '@/lib/format';

const initial: ActionResult = { ok: false };

export function CouponForm() {
  const [state, formAction] = useFormState(saveCouponAction, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
      >
        <Plus className="h-4 w-4" /> Nuevo cupón
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <h2 className="font-serif text-lg font-bold text-navy">Nuevo cupón</h2>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      {state.ok && state.message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Código</span>
          <input name="code" required placeholder="VERANO10" className="input uppercase" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Descuento %</span>
          <input type="number" name="percent" min={1} max={90} required defaultValue={10} className="input tabular" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Compra mínima</span>
          <input type="number" name="minTotal" min={0} placeholder="Opcional" className="input tabular" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Límite de usos</span>
          <input type="number" name="usageLimit" min={1} placeholder="Sin límite" className="input tabular" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy/55">Vencimiento</span>
          <input type="date" name="expiresAt" className="input" />
        </label>
      </div>

      <div className="flex gap-2">
        <SaveButton />
        <button type="button" onClick={() => setOpen(false)} className="btn-outline rounded-xl px-5 py-2.5 text-sm font-semibold">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold">
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Guardar
    </button>
  );
}

export function CouponRowActions({ code, active }: { code: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void toggleCouponAction(code))}
        title={active ? 'Desactivar' : 'Activar'}
        aria-label={active ? 'Desactivar cupón' : 'Activar cupón'}
        className="flex h-10 w-10 items-center justify-center rounded-lg sm:h-9 sm:w-9 text-navy/40 transition hover:bg-bg-2 hover:text-navy"
      >
        {active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 4000);
            return;
          }
          startTransition(() => void deleteCouponAction(code));
        }}
        aria-label="Eliminar cupón"
        className={cn(
          'flex h-10 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold transition sm:h-9',
          confirming ? 'bg-red-500 text-white' : 'w-10 text-navy/40 sm:w-9 hover:bg-red-50 hover:text-red-500',
        )}
      >
        <Trash2 className="h-4 w-4" />
        {confirming && 'Confirmar'}
      </button>
    </div>
  );
}
