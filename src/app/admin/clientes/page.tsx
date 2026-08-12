import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatPrice, formatDate } from '@/lib/format';
import { Users, MessageCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Registro de clientes.
 *
 * No hay tabla de clientes: se arma agrupando los pedidos por teléfono, que es
 * el dato que identifica a una persona (el nombre se escribe distinto cada vez:
 * "Juana", "juana perez", "Sra. Pérez"). Cada fila trae lo que hace falta para
 * escribirle: el link de WhatsApp, cuánto compró y cuándo vino por última vez.
 */
export default async function ClientesPage() {
  const orders = await prisma.order.findMany({
    where: { status: { not: 'CANCELADO' } },
    select: {
      customerName: true,
      phone: true,
      total: true,
      channel: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  interface Cliente {
    phone: string | null;
    name: string | null;
    pedidos: number;
    gastado: number;
    ultima: Date;
    canales: Set<string>;
  }

  const porTelefono = new Map<string, Cliente>();
  for (const o of orders) {
    // Sin teléfono no hay a quién escribirle: esos pedidos no arman ficha.
    if (!o.phone) continue;
    const key = o.phone.replace(/\D/g, '');
    if (!key) continue;

    const actual = porTelefono.get(key);
    if (actual) {
      actual.pedidos++;
      actual.gastado += o.total;
      // Los pedidos vienen del más nuevo al más viejo, así que el primer nombre
      // que aparece es el más reciente — y es el que se conserva.
      actual.name ??= o.customerName;
      actual.canales.add(o.channel);
    } else {
      porTelefono.set(key, {
        phone: key,
        name: o.customerName,
        pedidos: 1,
        gastado: o.total,
        ultima: o.createdAt,
        canales: new Set([o.channel]),
      });
    }
  }

  const clientes = [...porTelefono.values()].sort((a, b) => b.ultima.getTime() - a.ultima.getTime());
  const sinTelefono = orders.filter((o) => !o.phone).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Clientes</h1>
        <p className="text-sm text-navy/55">
          <span className="font-semibold tabular">{clientes.length}</span> clientes con teléfono cargado
          {sinTelefono > 0 && ` · ${sinTelefono} pedidos sin teléfono`}
        </p>
      </div>

      {clientes.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <Users className="h-6 w-6 text-accent" />
          </div>
          <p className="font-semibold text-navy">Todavía no hay clientes registrados</p>
          <p className="mt-1 text-sm text-navy/55">
            Cargá el teléfono al confirmar una venta en{' '}
            <Link href="/admin/venta" className="font-semibold text-accent hover:underline">
              Punto de Venta
            </Link>{' '}
            y el cliente va a aparecer acá.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-navy/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Teléfono</th>
                <th className="px-4 py-3 font-semibold">Pedidos</th>
                <th className="px-4 py-3 font-semibold">Total gastado</th>
                <th className="px-4 py-3 font-semibold">Última compra</th>
                <th className="px-4 py-3 font-semibold">Dónde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {clientes.map((c) => (
                <tr key={c.phone} className="hover:bg-bg/50">
                  <td className="px-4 py-3 font-medium text-navy">{c.name ?? 'Sin nombre'}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://wa.me/${c.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {c.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 tabular text-navy/70">{c.pedidos}</td>
                  <td className="px-4 py-3 font-semibold tabular text-navy">{formatPrice(c.gastado)}</td>
                  <td className="px-4 py-3 text-navy/50">{formatDate(c.ultima)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-navy/55">
                      {[...c.canales].map((ch) => (ch === 'LOCAL' ? '🏪' : '🌐')).join(' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
