import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mídia por Mídia TV',
    short_name: 'Mídia TV',
    description: 'Player de TV da plataforma Mídia por Mídia.',
    start_url: '/tv',
    scope: '/',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'landscape',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      {
        src: '/media-tv-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/media-tv-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
