import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ProductForm } from '@/components/admin/ProductForm';
import { displayName } from '@/lib/format';
import { LegacyRawPanel } from '@/components/admin/LegacyRawPanel';

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const [product, categories, brands] = await Promise.all([
    prisma.product.findUnique({
      where: { id: params.id },
      include: { variants: { orderBy: { order: 'asc' } }, images: { orderBy: { order: 'asc' } } },
    }),
    prisma.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true, parentId: true } }),
    prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-navy">{displayName(product.name)}</h1>
        <p className="text-sm text-navy/55">Editar producto</p>
      </div>

      <ProductForm categories={categories} brands={brands} product={product} />

      {product.legacyRaw != null && <LegacyRawPanel raw={product.legacyRaw as Record<string, string>} />}
    </div>
  );
}
