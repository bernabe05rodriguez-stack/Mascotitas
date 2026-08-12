'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { deleteOrderAction } from '@/app/admin/actions';

/**
 * Borra un pedido, con confirmación en dos pasos.
 *
 * Un pedido borrado no se recupera, así que el primer click no borra: cambia el
 * botón por "¿Seguro?". En una lista de pedidos apretados uno contra otro, un
 * borrado a un solo toque se dispara sin querer.
 */
export function DeleteOrderButton({ orderId }: { orderId: number }) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={`Eliminar el pedido ${orderId}`}
        title="Eliminar pedido"
        className="grid h-8 w-8 place-items-center rounded-full text-navy/35 transition hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteOrderAction(orderId);
            // El stock devuelto tiene que verse sin recargar a mano.
            router.refresh();
          })
        }
        className="flex items-center gap-1 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-3 w-3 animate-spin" />}
        Sí, borrar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setArmed(false)}
        className="rounded-full px-2 py-1.5 text-xs font-semibold text-navy/50 transition hover:text-navy"
      >
        No
      </button>
    </span>
  );
}
