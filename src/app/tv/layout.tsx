import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Mídia por Mídia TV',
  description: 'Player de apresentação da Mídia por Mídia.',
  applicationName: 'Mídia por Mídia TV',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mídia TV',
  },
  icons: {
    icon: [{ url: '/media-tv-icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/media-tv-icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
};

export default function TvLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
