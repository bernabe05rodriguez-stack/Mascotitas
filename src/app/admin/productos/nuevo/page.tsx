import { prisma } from '@/lib/db';
import { ProductForm } from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true, parentId: true } }),
    prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">Nuevo producto</h1>
        <p className="text-sm text-navy/55">Se publica apenas lo guardes, si lo dejás visible.</p>
      </div>
      <ProductForm categories={categories} brands={brands} />
    </div>
  );
}
