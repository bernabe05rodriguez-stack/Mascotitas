'use client';

import { useTransition } from 'react';
import { updateOrderStatusAction } from '@/app/admin/actions';

export function OrderStatusSelect({ orderId, current }: { orderId: number; current: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => {
        const status = e.target.value;
        startTransition(() => void updateOrderStatusAction(orderId, status));
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
