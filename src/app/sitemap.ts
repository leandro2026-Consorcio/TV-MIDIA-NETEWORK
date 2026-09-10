import type { MetadataRoute } from 'next';

const siteUrl = 'https://midiapormidia.com.br';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date('2026-08-04'),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/politica-de-privacidade`,
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/exclusao-de-dados`,
      lastModified: new Date('2026-09-09'),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];
}
