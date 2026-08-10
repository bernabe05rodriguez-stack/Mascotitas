import Link from 'next/link';
import { Package, ShoppingBag, AlertTriangle, TrendingUp, ImageOff, Star } from 'lucide-react';
import { prisma } from '@/lib/db';
import { formatPrice, formatDate, displayName } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalProducts,
    activeProducts,
    outOfStock,
    featured,
    withoutImage,
    totalOrders,
    recentOrders,
    revenue,
    lastOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: true, stock: 0 } }),
    prisma.product.count({ where: { active: true, featured: true } }),
    prisma.product.count({ where: { active: true, images: { none: {} } } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: since }, status: { not: 'CANCELADO' } } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { items: { select: { productName: true, quantity: true } } },
    }),
  ]);

  const stats = [
    { label: 'Productos activos', value: activeProducts, sub: `${totalProducts} en total`, icon: Package, href: '/admin/productos' },
    { label: 'Pedidos (30 días)', value: recentOrders, sub: `${totalOrders} históricos`, icon: ShoppingBag, href: '/admin/pedidos' },
    { label: 'Facturado (30 días)', value: formatPrice(revenue._sum.total ?? 0), sub: 'sin cancelados', icon: TrendingUp, href: '/admin/pedidos' },
    { label: 'Sin stock', value: outOfStock, sub: 'no se pueden comprar', icon: AlertTriangle, href: '/admin/productos?stock=0' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Resumen</h1>
        <p className="text-sm text-navy/55">Cómo viene la tienda</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
              <Icon className="h-4 w-4 text-accent" />
            </div>
            <p className="text-2xl font-bold text-navy tabular">{value}</p>
            <p className="text-sm font-medium text-navy/70">{label}</p>
            <p className="text-xs text-navy/40">{sub}</p>
          </Link>
        ))}
      </div>

      {/* Cosas que conviene revisar */}
      {(withoutImage > 0 || featured === 0) && (
        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-5">
          <h2 className="mb-3 text-sm font-semibold text-navy">Para revisar</h2>
          <ul className="space-y-2 text-sm text-navy/70">
            {withoutImage > 0 && (
              <li className="flex items-center gap-2">
                <ImageOff className="h-4 w-4 shrink-0 text-accent" />
                <span>
                  {withoutImage} {withoutImage === 1 ? 'producto activo no tiene foto' : 'productos activos no tienen foto'} —{' '}
                  <Link href="/admin/productos?sinFoto=1" className="font-semibold text-accent hover:underline">
                    verlos
                  </Link>
                </span>
              </li>
            )}
            {featured === 0 && (
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 shrink-0 text-accent" />
                <span>No hay productos destacados: el carrusel de la home se llena solo con lo que haya.</span>
              </li>
            )}
          </ul>
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-navy">Últimos pedidos</h2>
          <Link href="/admin/pedidos" className="text-sm font-semibold text-accent hover:underline">
            Ver todos
          </Link>
        </div>

        {lastOrders.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-navy/50">
            Todavía no hay pedidos registrados. Los que entren por la tienda van a aparecer acá.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-navy/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Productos</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lastOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-semibold text-navy tabular">{o.id}</td>
                    <td className="px-4 py-3 text-navy/70">{o.customerName ?? '—'}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-navy/60">
                      {o.items.map((i) => `${i.quantity}× ${displayName(i.productName)}`).join(', ')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-navy tabular">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3 text-navy/50">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
