import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Truck, ShieldCheck, MessagesSquare } from 'lucide-react';
import { getProductBySlug, getRelatedProducts } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { ProductCard } from '@/components/shop/ProductCard';
import { ProductBuyBox } from '@/components/shop/ProductBuyBox';
import { formatPrice, priceRange, displayName } from '@/lib/format';

// Se renderiza por request. La alternativa (prerenderizar en el build con
// generateStaticParams) obliga a que la base esté disponible al construir la
// imagen, y en el build de EasyPanel no lo está: era lo que rompía el deploy.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) return { title: 'Producto no encontrado' };

  const range = priceRange(product.variants);
  const brand = product.brand?.name ? `${product.brand.name} ` : '';

  return {
    title: `${displayName(product.name)} — ${brand}en Mendoza`,
    description:
      product.description ??
      `${displayName(product.name)} desde ${formatPrice(range.min)}. ${brand}Envío en el día en Mendoza. Consultá stock por WhatsApp.`,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      type: 'website',
      title: displayName(product.name),
      description: `Desde ${formatPrice(range.min)} · Envío en el día en Mendoza`,
      images: product.images[0] ? [{ url: product.images[0].url, alt: displayName(product.name) }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();

  const [related, settings] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId, product.brandId),
    getSettings(),
  ]);

  const range = priceRange(product.variants);
  const inStock = product.stock > 0;
  const parent = product.category.parent;

  // JSON-LD por producto: es lo que hace que Google muestre precio y
  // disponibilidad en los resultados. Con una sola URL para todo el catálogo
  // esto era imposible.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: displayName(product.name),
    description: product.description ?? `${displayName(product.name)} disponible en Mascotitas, ${settings.city}.`,
    image: product.images.map((i) => new URL(i.url, process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mascotitas.online').toString()),
    sku: product.legacyId ?? product.slug,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand.name } } : {}),
    offers: product.variants.map((v) => ({
      '@type': 'Offer',
      name: v.label,
      price: v.price,
      priceCurrency: 'ARS',
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mascotitas.online'}/producto/${product.slug}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs text-navy/50" aria-label="Migas de pan">
          <Link href="/" className="transition hover:text-accent">
            Inicio
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/catalogo" className="transition hover:text-accent">
            Catálogo
          </Link>
          {parent && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link href={`/catalogo?category=${parent.slug}`} className="transition hover:text-accent">
                {parent.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <Link href={`/catalogo?category=${product.category.slug}`} className="transition hover:text-accent">
            {product.category.name}
          </Link>
        </nav>

        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <ProductBuyBox product={product} settings={settings} />
        </div>

        {/* Garantías */}
        <div className="mt-12 grid gap-4 rounded-3xl border border-line bg-white p-6 sm:grid-cols-3">
          {[
            { icon: Truck, title: 'Envío en el día', text: `Gratis desde ${formatPrice(settings.freeShippingThreshold)}` },
            { icon: ShieldCheck, title: 'Producto original', text: 'Directo de distribuidora' },
            { icon: MessagesSquare, title: '¿Dudas?', text: 'Te asesoramos por WhatsApp' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{ background: 'rgba(224,122,60,.08)', borderColor: 'rgba(224,122,60,.15)' }}
              >
                <Icon className="h-4 w-4 text-accent" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">{title}</p>
                <p className="text-xs text-navy/55">{text}</p>
              </div>
            </div>
          ))}
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-extrabold text-navy">
              {product.brand ? `Más de ${product.brand.name}` : 'También te puede servir'}
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
