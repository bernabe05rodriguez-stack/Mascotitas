import type { Metadata, Viewport } from 'next';
import { Fraunces, Poppins } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/components/cart/CartProvider';

// Las fuentes se auto-hospedan en el build: se van dos requests a
// fonts.googleapis.com y desaparece el salto de tipografía al cargar.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '800'],
  variable: '--font-fraunces',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mascotitas.online';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Mascotitas | Alimento para perros y gatos en Mendoza con envío en el día',
    template: '%s | Mascotitas',
  },
  description:
    'Pet shop en Mendoza: alimento balanceado para perros y gatos, accesorios, camas y juguetes. Royal Canin, Pro Plan, Old Prince, Sieger y más. Envío en el día y pago en efectivo.',
  keywords: [
    'alimento perros mendoza',
    'alimento gatos mendoza',
    'pet shop mendoza',
    'royal canin mendoza',
    'pro plan mendoza',
    'old prince mendoza',
    'balanceado mendoza',
    'accesorios mascotas mendoza',
  ],
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: SITE_URL,
    siteName: 'Mascotitas',
    title: 'Mascotitas | Alimento para mascotas en Mendoza',
    description: 'Alimento balanceado, accesorios y camas para perros y gatos. Envío en el día en Mendoza.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 1200, alt: 'Mascotitas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mascotitas | Alimento para mascotas en Mendoza',
    description: 'Alimento balanceado, accesorios y camas para perros y gatos. Envío en el día en Mendoza.',
    images: ['/og-image.jpg'],
  },
  other: {
    'geo.region': 'AR-M',
    'geo.placename': 'Mendoza',
    'google-site-verification': 'iCUvMRtVt2g9zKfZmtxIzr-MfiDUeLcjuxJW9X-ZfJs',
  },
};

export const viewport: Viewport = {
  themeColor: '#E07A3C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${fraunces.variable} ${poppins.variable}`}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
