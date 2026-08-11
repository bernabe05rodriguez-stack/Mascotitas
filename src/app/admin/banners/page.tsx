import { prisma } from '@/lib/db';
import { BannerAdmin } from '@/components/admin/BannerAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminBannersPage() {
  const banners = await prisma.banner.findMany({ orderBy: { order: 'asc' } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Banners</h1>
        <p className="max-w-2xl text-sm text-navy/55">
          Placas promocionales para el carrusel de la portada: una imagen diseñada con su link. Van antes de los
          productos destacados. Si les ponés fecha de fin, se apagan solas.
        </p>
      </div>

      <BannerAdmin banners={banners} />
    </div>
  );
}
