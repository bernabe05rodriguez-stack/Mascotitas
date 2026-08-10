import { Suspense } from 'react';
import { Navbar } from '@/components/shop/Navbar';
import { Footer } from '@/components/shop/Footer';
import { CartSidebar } from '@/components/cart/CartSidebar';
import { WhatsAppFab } from '@/components/shop/WhatsAppFab';
import { getSettings } from '@/lib/settings';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <>
      {/* Navbar lee searchParams para precargar el buscador: necesita Suspense. */}
      <Suspense fallback={<div className="h-16 border-b border-line/70 bg-bg sm:h-20" />}>
        <Navbar />
      </Suspense>

      <main>{children}</main>

      <Footer settings={settings} />

      <CartSidebar
        whatsapp={settings.whatsapp}
        freeShippingThreshold={settings.freeShippingThreshold}
        shippingCost={settings.shippingCost}
      />
      <WhatsAppFab whatsapp={settings.whatsapp} />
    </>
  );
}
