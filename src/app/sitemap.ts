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
  ];
}
