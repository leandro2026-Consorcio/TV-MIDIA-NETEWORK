import type { MetadataRoute } from 'next';

const siteUrl = 'https://midiapormidia.com.br';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/dashboard',
        '/player',
        '/tv',
        '/invite/',
        '/login',
        '/register',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
