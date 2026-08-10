import { prisma } from '@/lib/db';
import { CategoryAdmin } from '@/components/admin/CategoryAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      order: true,
      parentId: true,
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Categorías</h1>
        <p className="text-sm text-navy/55">
          Las subcategorías de Accesorios se armaron automáticamente al migrar. Si algún producto quedó mal clasificado,
          se cambia desde su ficha.
        </p>
      </div>

      <CategoryAdmin categories={categories} />
    </div>
  );
}
