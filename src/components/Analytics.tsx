'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * Google Analytics 4.
 *
 * Se incluye sólo si NEXT_PUBLIC_GA_ID está configurado. Así el cliente
 * crea su propiedad en analytics.google.com, pega el ID (G-XXXXXXX) en
 * EasyPanel y listo — sin tocar código.
 */
export function Analytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}

/**
 * Trackea eventos personalizados en GA4.
 *
 * Uso:
 *   trackEvent('view_item', { item_id: 'abc', item_name: 'Royal Canin' })
 *   trackEvent('add_to_cart', { item_id: 'abc', value: 5000 })
 *   trackEvent('begin_checkout', { value: 15000 })
 *   trackEvent('contact_whatsapp', { item_id: 'abc' })
 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', name, params);
  }
}
