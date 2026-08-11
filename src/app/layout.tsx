import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = 'https://midiapormidia.com.br';
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Mídia por Mídia | Mídia Indoor e TV Corporativa em Sinop-MT e Brasil',
    template: '%s | Mídia por Mídia',
  },
  description:
    'Plataforma de mídia indoor e TV corporativa em Sinop-MT. Transforme sua Smart TV em canal de comunicação e propaganda local. Teste grátis por 60 dias sem cartão.',
  applicationName: 'Mídia por Mídia',
  authors: [
    { name: 'MSD Digital', url: 'https://msddigital.com.br' },
    { name: 'Mídia por Mídia', url: siteUrl },
  ],
  creator: 'MSD Digital (msddigital.com.br)',
  publisher: 'MSD Digital',
  category: 'Tecnologia e publicidade',
  keywords: [
    'mídia indoor',
    'mídia indoor Sinop',
    'mídia indoor MT',
    'mídia indoor Mato Grosso',
    'TV corporativa',
    'publicidade em TV Sinop',
    'propaganda em TV',
    'propaganda local',
    'rede de mídia local',
    'digital signage Brasil',
    'digital signage Sinop',
    'painel de mídia indoor',
    'anúncios em TV',
    'divulgação para empresas Sinop',
    'monetização de TV corporativa',
    'mídia compartilhada',
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
    title: 'Mídia por Mídia | Plataforma de Mídia Indoor em Sinop-MT e Brasil',
    description:
      'Cadastre sua empresa, conecte sua Smart TV e publique propagandas em Sinop-MT e em todo o Brasil. 60 dias grátis sem cartão de crédito.',
    images: [
      {
        url: '/og.png',
        width: 1731,
        height: 909,
        alt: 'Mídia por Mídia — plataforma de mídia indoor e TV corporativa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mídia por Mídia | Mídia Indoor em Sinop-MT',
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
    'geo.region': 'BR-MT',
    'geo.placename': 'Sinop, Mato Grosso, Brasil',
    'geo.position': '-11.8641;-55.5053',
    'ICBM': '-11.8641, -55.5053',
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
