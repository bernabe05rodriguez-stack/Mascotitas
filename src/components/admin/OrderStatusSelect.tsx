'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrderStatusAction } from '@/app/admin/actions';

/**
 * Selector de estado del pedido.
 *
 * Pasar a "Entregado" es lo que descuenta el stock (y volver atrás lo devuelve):
 * el trabajo pesado lo hace la server action. Acá lo importante es el
 * `router.refresh()` — sin él la página sigue mostrando el stock viejo hasta que
 * alguien recargue a mano, que es justo lo que hacía parecer que no descontaba.
 */
export function OrderStatusSelect({ orderId, current }: { orderId: number; current: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => {
        const status = e.target.value;
        startTransition(async () => {
          await updateOrderStatusAction(orderId, status);
          router.refresh();
        });
      }}
      aria-label={`Estado del pedido ${orderId}`}
      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy focus:border-accent focus:outline-none disabled:opacity-50"
    >
      <option value="PENDIENTE">Pendiente</option>
      <option value="CONFIRMADO">Confirmado</option>
      <option value="ENTREGADO">Entregado</option>
      <option value="CANCELADO">Cancelado</option>
    </select>
  );
}
