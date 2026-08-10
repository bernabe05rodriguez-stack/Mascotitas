import { prisma } from '@/lib/db';
import { formatPrice, formatDate } from '@/lib/format';
import { CouponForm, CouponRowActions } from '@/components/admin/CouponAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Cupones</h1>
        <p className="text-sm text-navy/55">
          Se validan en el servidor: el código ya no viaja al navegador, así que no se pueden adivinar leyendo la página.
        </p>
      </div>

      <CouponForm />

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-navy/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Descuento</th>
              <th className="px-4 py-3 font-semibold">Mínimo</th>
              <th className="px-4 py-3 font-semibold">Usos</th>
              <th className="px-4 py-3 font-semibold">Vence</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-navy/50">
                  No hay cupones cargados.
                </td>
              </tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id} className={c.active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-bold text-navy">{c.code}</td>
                  <td className="px-4 py-3 text-navy/70 tabular">{c.percent}%</td>
                  <td className="px-4 py-3 text-navy/70 tabular">{c.minTotal ? formatPrice(c.minTotal) : '—'}</td>
                  <td className="px-4 py-3 text-navy/70 tabular">
                    {c.usageCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-navy/70">{c.expiresAt ? formatDate(c.expiresAt) : 'Sin vencimiento'}</td>
                  <td className="px-4 py-3">
                    <CouponRowActions code={c.code} active={c.active} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
