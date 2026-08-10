import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mascotitas.online';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // El panel no tiene por qué aparecer en Google.
      disallow: ['/admin', '/api'],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
