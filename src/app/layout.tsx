import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = 'https://midiapormidia.com.br';
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Mídia por Mídia | Plataforma de mídia indoor local',
    template: '%s | Mídia por Mídia',
  },
  description:
    'Transforme sua TV em mídia indoor local. Cadastre sua empresa, publique propagandas e conecte parceiros da sua cidade. Teste grátis por 60 dias.',
  applicationName: 'Mídia por Mídia',
  authors: [{ name: 'Mídia por Mídia', url: siteUrl }],
  creator: 'Mídia por Mídia',
  publisher: 'Mídia por Mídia',
  category: 'Tecnologia e publicidade',
  keywords: [
    'mídia indoor',
    'TV corporativa',
    'publicidade em TV',
    'propaganda local',
    'rede de mídia local',
    'digital signage Brasil',
    'painel de mídia indoor',
    'divulgação para empresas',
  ],
  alternates: {
    canonical: '/',
    languages: {
      'pt-BR': '/',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: 'Mídia por Mídia',
    title: 'Mídia por Mídia | Transforme sua TV em mídia local',
    description:
      'Cadastre sua empresa, conecte sua TV e publique sua propaganda. São 60 dias grátis, sem cartão e com acesso imediato.',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'Mídia por Mídia — transforme sua TV em mídia local e teste por 60 dias grátis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mídia por Mídia | Transforme sua TV em mídia local',
    description:
      'Conecte sua TV, publique sua propaganda e fortaleça a rede de mídia da sua cidade. Teste grátis por 60 dias.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [{ url: '/media-tv-icon.svg', type: 'image/svg+xml' }],
    shortcut: '/media-tv-icon.svg',
    apple: '/media-tv-icon.svg',
  },
  verification: googleVerification
    ? {
        google: googleVerification,
      }
    : undefined,
  other: {
    'content-language': 'pt-BR',
    'geo.region': 'BR',
    'geo.placename': 'Brasil',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
