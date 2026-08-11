import { prisma } from '@/lib/db';
import { formatPrice, formatDate, displayName } from '@/lib/format';
import { OrderStatusSelect } from '@/components/admin/OrderStatusSelect';
import { ShoppingBag } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 40;

const STATUS_STYLES: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-700',
  CONFIRMADO: 'bg-blue-50 text-blue-700',
  ENTREGADO: 'bg-green-50 text-green-700',
  CANCELADO: 'bg-red-50 text-red-600',
};

export default async function AdminOrdersPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const where = searchParams.status ? { status: searchParams.status as never } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.order.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Pedidos</h1>
        <p className="text-sm text-navy/55">
          <span className="font-semibold tabular">{total}</span> pedidos registrados
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="Todos" href="/admin/pedidos" active={!searchParams.status} />
        {['PENDIENTE', 'CONFIRMADO', 'ENTREGADO', 'CANCELADO'].map((s) => (
          <FilterChip
            key={s}
            label={s.charAt(0) + s.slice(1).toLowerCase()}
            href={`/admin/pedidos?status=${s}`}
            active={searchParams.status === s}
          />
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <ShoppingBag className="h-6 w-6 text-accent" />
          </div>
          <p className="font-semibold text-navy">Todavía no hay pedidos</p>
          <p className="mt-1 text-sm text-navy/55">
            Cada pedido que se confirme por WhatsApp desde la tienda va a quedar registrado acá.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <article key={o.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-lg font-bold text-navy tabular">#{o.id}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[o.status]}`}>
                      {o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${(o as unknown as {channel:string}).channel === 'LOCAL' ? 'bg-purple-50 text-purple-700' : 'bg-sky-50 text-sky-700'}`}>
                      {(o as unknown as {channel:string}).channel === 'LOCAL' ? '🏪 Local' : '🌐 Web'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-navy/60">
                    {o.customerName ?? 'Sin nombre'}
                    {o.phone && (
                      <>
                        {' · '}
                        <a href={`https://wa.me/${o.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                          {o.phone}
                        </a>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-navy/40">{formatDate(o.createdAt)}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold text-navy tabular">{formatPrice(o.total)}</p>
                    {o.discount > 0 && (
                      <p className="text-xs text-green-600 tabular">
                        {o.couponCode} −{formatPrice(o.discount)}
                      </p>
                    )}
                  </div>
                  <OrderStatusSelect orderId={o.id} current={o.status} />
                </div>
              </div>

              <ul className="space-y-1 border-t border-line pt-3 text-sm">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 text-navy/70">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-navy tabular">{i.quantity}×</span> {displayName(i.productName)}
                      {i.variantLabel !== 'Unidad' && <span className="text-navy/45"> ({i.variantLabel})</span>}
                    </span>
                    <span className="shrink-0 tabular">{formatPrice(i.unitPrice * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <a href={href} className={`chip flex min-h-[42px] items-center ${active ? 'chip-active' : 'chip-idle'}`}>
      {label}
    </a>
  );
}
