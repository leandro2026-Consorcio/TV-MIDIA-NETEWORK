import Link from 'next/link';
import { WhatsAppButton } from '@/components/whatsapp-button';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  CirclePlay,
  Clock3,
  Gift,
  Handshake,
  ImageUp,
  LayoutDashboard,
  ListChecks,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  MonitorPlay,
  Phone,
  Play,
  Sparkles,
  Tv,
  Upload,
  UserPlus,
  Users,
  Video,
  Wifi,
  Zap,
} from 'lucide-react';

const signupHref = '/empresa/cadastro';

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Cadastre sua empresa',
    text: 'Crie sua conta em poucos minutos e receba 60 dias grátis, sem cartão.',
  },
  {
    number: '02',
    icon: MonitorPlay,
    title: 'Conecte sua TV e envie sua mídia',
    text: 'Abra o link da TV, faça o pareamento e envie imagens ou vídeos da sua propaganda.',
  },
  {
    number: '03',
    icon: Handshake,
    title: 'Divulgue e convide parceiros',
    text: 'Coloque sua propaganda no ar e convide 3 empresas estratégicas para testar também.',
  },
];

const benefits = [
  {
    icon: Sparkles,
    title: '60 dias grátis para experimentar',
    text: 'Teste o painel, cadastre sua TV e publique suas mídias sem compromisso.',
  },
  {
    icon: Zap,
    title: 'Acesso imediato',
    text: 'Terminou o cadastro? Você já entra no painel para configurar sua empresa.',
  },
  {
    icon: BadgeCheck,
    title: 'Sem aprovação manual',
    text: 'Com o cadastro público ativo, sua empresa é liberada automaticamente.',
  },
  {
    icon: Wifi,
    title: 'TV fácil de configurar',
    text: 'Abra o link na TV, digite o código e conecte sua tela em poucos passos.',
  },
  {
    icon: CirclePlay,
    title: 'Divulgação no seu espaço',
    text: 'Mostre promoções, serviços e campanhas nas TVs da sua própria empresa.',
  },
  {
    icon: MapPin,
    title: 'Rede local de parceiros',
    text: 'Convide empresas da sua cidade e ajude a criar uma rede de mídia mais forte.',
  },
];

const resources = [
  { icon: LayoutDashboard, label: 'Cadastrar sua empresa' },
  { icon: Tv, label: 'Cadastrar sua TV' },
  { icon: Upload, label: 'Enviar imagens e vídeos' },
  { icon: ListChecks, label: 'Criar sua programação' },
  { icon: Play, label: 'Rodar propaganda na tela' },
  { icon: Video, label: 'Usar conteúdo de respiro' },
  { icon: BarChart3, label: 'Acompanhar o checklist inicial' },
  { icon: Users, label: 'Convidar 3 empresas parceiras' },
];

const pricingPlans = [
  {
    id: '1-tv',
    title: '1 TV',
    price: 'R$ 29,90',
    period: '/mês',
    subtitle: 'Ideal para quem deseja iniciar a divulgação em tela própria.',
    badge: 'Iniciante',
    popular: false,
    includesPrevious: null,
    features: [
      'Inclua mídias (vídeos e imagens)',
      'Alterne entre notícias em tempo real e propagandas',
      'Conecte sua Smart TV direto na internet sem necessidade de outros equipamentos',
      'Controle total de quantidade de visualizações',
      'Número ilimitado de imagens ou vídeos',
      'Exibição em formato Vertical ou Horizontal',
    ],
  },
  {
    id: '2-tvs',
    title: '2 TVs',
    price: 'R$ 49,90',
    period: '/mês',
    subtitle: 'Monetize e venda espaços nas suas telas para terceiros.',
    badge: 'Venda de Espaço',
    popular: false,
    includesPrevious: '1 TV',
    features: [
      'Adicione venda de propagandas pelo nosso site ou permita que pessoas comprem espaços dentro da sua TV',
      'Escolha os nichos que podem aparecer na sua TV',
      'Receba 90% de todo o valor negociado nas suas telas',
    ],
  },
  {
    id: '3-tvs',
    title: '3 TVs',
    price: 'R$ 69,90',
    period: '/mês',
    subtitle: 'Amplie seu alcance criando redes de mídia compartilhada.',
    badge: 'Mídia Compartilhada',
    popular: false,
    includesPrevious: '1 e 2 TVs',
    features: [
      'Compartilhe propagandas gerando créditos (apareça em mais TVs sem investimento financeiro)',
      'Convide parceiros para entrarem para seu grupo de mídia compartilhada',
      'Controle total de créditos e débitos dos compartilhamentos',
    ],
  },
  {
    id: '4-tvs',
    title: '4 TVs',
    price: 'R$ 89,90',
    period: '/mês',
    subtitle: 'Gestão multi-usuário e relatórios detalhados.',
    badge: 'Gestão Avançada',
    popular: false,
    includesPrevious: '1, 2 e 3 TVs',
    features: [
      'Mais de um usuário para controle e gestão do painel',
      'Emita relatórios de visualizações e relatórios operacionais',
      'Troque o valor da mensalidade por espaços nas suas TVs',
    ],
  },
  {
    id: '5-tvs',
    title: '5 TVs',
    price: 'R$ 99,90',
    period: '/mês',
    additionalTv: '+ R$ 14,99 por TV adicional',
    subtitle: 'Sem mensalidades e faturamento potencial superior a R$ 3.000,00.',
    badge: '⭐ Mais Escolhido / Faturamento Máximo',
    popular: true,
    includesPrevious: '1, 2, 3 e 4 TVs',
    features: [
      'Não pague mensalidades e ganhe valores mensais',
      'Entre para o grupo de mídia compartilhada e escolha em quais locais quer aparecer',
      'Venda espaços dentro da sua TV para eventos na sua cidade ou região',
      'Rendas em anúncios vendidos podem superar R$ 3.000,00/mês',
    ],
  },
];

const faqs = [
  {
    question: 'Precisa de aprovação manual para começar?',
    answer:
      'Não. O cadastro é 100% automático. Assim que você cria sua conta, recebe acesso imediato ao painel para cadastrar sua empresa, configurar suas TVs e enviar suas mídias.',
  },
  {
    question: 'Precisa de cartão de crédito para os 60 dias grátis?',
    answer:
      'Não! O teste gratuito dura 60 dias a partir da criação da conta e não exige nenhum cartão de crédito ou compromisso financeiro inicial.',
  },
  {
    question: 'Quais são os planos e mensalidades disponíveis?',
    answer:
      'Possuímos planos flexíveis de 1 a 5 TVs com vantagens acumulativas: 1 TV por R$ 29,90/mês, 2 TVs por R$ 49,90/mês, 3 TVs por R$ 69,90/mês, 4 TVs por R$ 89,90/mês e 5 TVs por R$ 99,90/mês (+ R$ 14,99 por TV adicional). Todos iniciam com 60 dias grátis.',
  },
  {
    question: 'Como funciona o programa Indique e Ganhe para membros?',
    answer:
      'Após se tornar membro, para cada empresa indicada em qualquer plano que assinar e pagar a 1ª mensalidade, quem indicou ganha 1 mensalidade inteiramente grátis para sua empresa. Não há limite de indicações!',
  },
  {
    question: 'Como funciona a venda de propagandas na minha TV?',
    answer:
      'A partir do plano de 2 TVs, você pode disponibilizar espaços da sua tela à venda no nosso site. Outras empresas compram anúncios diretamente e você recebe 90% de todo o valor negociado nas suas telas.',
  },
  {
    question: 'Preciso comprar aparelhos ou equipamentos específicos?',
    answer:
      'Não. Qualquer Smart TV conectada à internet ou dispositivo comum com navegador web pode ser conectado diretamente sem necessidade de comprar TV Box ou equipamentos extras.',
  },
  {
    question: 'Quais mídias e formatos são suportados?',
    answer:
      'Você pode enviar imagens e vídeos ilimitados na orientação Vertical ou Horizontal, além de alternar com exibição de notícias em tempo real e conteúdos de respiro.',
  },
  {
    question: 'Como funciona a mídia compartilhada por créditos?',
    answer:
      'A partir do plano de 3 TVs, sua empresa pode participar do grupo de mídia compartilhada. Suas exibições geram créditos para veicular sua marca em telas de empresas parceiras na cidade sem custos adicionais.',
  },
  {
    question: 'Onde fica localizada a Mídia por Mídia e qual é o contato?',
    answer:
      'Nossa sede está localizada na Av. das Embaúbas, 2114 - Setor Comercial, Sinop-MT (CEP 78550-110), inscrita no CNPJ 10.764.218/0001-76. Nosso contato direto via telefone e WhatsApp é (66) 99608-6030.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'LocalBusiness',
      '@id': 'https://midiapormidia.com.br/#organization',
      name: 'Mídia por Mídia - Rede Indoor Local',
      legalName: 'Mídia por Mídia',
      taxID: '10.764.218/0001-76',
      url: 'https://midiapormidia.com.br/',
      telephone: '+55-66-99608-6030',
      logo: {
        '@type': 'ImageObject',
        url: 'https://midiapormidia.com.br/media-tv-icon.svg',
      },
      image: 'https://midiapormidia.com.br/og.png',
      description:
        'Plataforma de mídia indoor e TV corporativa em Sinop-MT e Brasil. Cadastre TVs, publique propagandas e crie redes de mídias parceiras.',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Av. das Embaúbas, 2114 - Setor Comercial',
        addressLocality: 'Sinop',
        addressRegion: 'MT',
        postalCode: '78550-110',
        addressCountry: 'BR',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: '-11.8641',
        longitude: '-55.5053',
      },
      areaServed: [
        {
          '@type': 'City',
          name: 'Sinop',
        },
        {
          '@type': 'State',
          name: 'Mato Grosso',
        },
        {
          '@type': 'Country',
          name: 'Brasil',
        },
      ],
      priceRange: 'R$ 0,00 - R$ 99,90',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://midiapormidia.com.br/#website',
      url: 'https://midiapormidia.com.br/',
      name: 'Mídia por Mídia',
      alternateName: 'Rede Indoor Local Sinop-MT',
      inLanguage: 'pt-BR',
      publisher: {
        '@id': 'https://midiapormidia.com.br/#organization',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://midiapormidia.com.br/#software',
      name: 'Mídia por Mídia',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Digital Signage',
      operatingSystem: 'Web',
      url: 'https://midiapormidia.com.br/',
      inLanguage: 'pt-BR',
      description:
        'Plataforma de mídia indoor para cadastrar Smart TVs, publicar imagens/vídeos e gerenciar redes de mídia indoor local.',
      provider: {
        '@id': 'https://midiapormidia.com.br/#organization',
      },
      areaServed: {
        '@type': 'Country',
        name: 'Brasil',
      },
      offers: {
        '@type': 'Offer',
        name: 'Teste gratuito por 60 dias sem cartão de crédito',
        price: '0',
        priceCurrency: 'BRL',
        url: 'https://midiapormidia.com.br/empresa/cadastro',
        availability: 'https://schema.org/InStock',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://midiapormidia.com.br/#faq',
      mainEntity: faqs.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answer,
        },
      })),
    },
  ],
};

function Logo() {
  return (
    <Link href="#inicio" className="flex items-center gap-2.5" aria-label="Mídia por Mídia - início">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20">
        <Tv className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className="leading-none">
        <strong className="block text-[15px] font-extrabold tracking-tight text-white sm:text-base">
          Mídia por Mídia
        </strong>
        <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">
          Rede Indoor Local
        </span>
      </span>
    </Link>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  centered = true,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-base leading-7 text-slate-400 sm:text-lg">{description}</p>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main id="inicio" className="min-h-screen overflow-hidden bg-[#07101f] text-white selection:bg-cyan-300 selection:text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#07101f]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <Logo />

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex" aria-label="Navegação principal">
            <a href="#como-funciona" className="transition hover:text-cyan-300">Como funciona</a>
            <a href="#beneficios" className="transition hover:text-cyan-300">Benefícios</a>
            <a href="#planos" className="transition hover:text-cyan-300">Planos e Preços</a>
            <a href="#convites" className="transition hover:text-cyan-300">Convites</a>
            <a href="#duvidas" className="transition hover:text-cyan-300">Dúvidas</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="px-2 py-2 text-sm font-semibold text-slate-300 transition hover:text-white sm:px-3">
              Entrar
            </Link>
            <Link href={signupHref} className="hidden rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-cyan-400/15 transition hover:-translate-y-0.5 hover:bg-cyan-300 sm:block">
              Testar 60 dias grátis
            </Link>
            <a href="#como-funciona" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-300 lg:hidden" aria-label="Ver como funciona">
              <Menu className="h-5 w-5" />
            </a>
          </div>
        </div>
      </header>

      <section className="relative px-4 pb-20 pt-28 sm:px-6 sm:pb-28 sm:pt-36 lg:px-8 lg:pt-44">
        <div className="absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-500/[0.09] blur-[120px]" />
        <div className="absolute -right-32 top-64 h-80 w-80 rounded-full bg-blue-600/10 blur-[100px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
          <div className="text-center lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan-300 sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              60 dias grátis <span className="text-slate-600">•</span> acesso imediato
            </div>

            <h1 className="text-4xl font-black leading-[1.06] tracking-[-0.045em] text-white sm:text-5xl lg:text-[64px]">
              Transforme sua TV em{' '}
              <span className="bg-gradient-to-r from-cyan-300 to-sky-500 bg-clip-text text-transparent">
                mídia local.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8 lg:mx-0">
              Cadastre sua empresa, acesse o painel na hora, envie sua propaganda e conecte sua TV — tudo sem aprovação manual.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base lg:mx-0">
              E ainda receba 3 convites VIP para fortalecer a rede de mídia da sua cidade com empresas parceiras.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Link href={signupHref} className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 text-base font-extrabold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-300">
                Quero testar grátis agora
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>
              <Link href={signupHref} className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-6 text-base font-bold text-white transition hover:border-white/25 hover:bg-white/[0.08]">
                Criar empresa grátis
              </Link>
              <a href="#como-funciona" className="inline-flex min-h-14 items-center justify-center px-4 text-sm font-bold text-slate-400 transition hover:text-white">
                Ver como funciona
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500 lg:justify-start">
              {['Sem cartão', 'Sem aprovação manual', 'Acesso imediato', 'Para empresas em todo o Brasil'].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" /> {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="absolute -inset-6 rounded-[36px] bg-gradient-to-br from-cyan-400/15 via-transparent to-blue-600/15 blur-2xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1728] p-3 shadow-2xl shadow-black/40 sm:p-5">
              <div className="mb-4 flex items-center justify-between px-1">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Olá, sua empresa!</p>
                  <p className="mt-1 text-base font-extrabold text-white">Seu início na Mídia por Mídia</p>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Ativo</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-400/[0.12] to-blue-500/[0.06] p-4 sm:p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Teste gratuito</p>
                      <div className="mt-2 flex items-end gap-2">
                        <strong className="text-4xl font-black text-white sm:text-5xl">60</strong>
                        <span className="pb-1.5 text-sm text-slate-400">dias restantes</span>
                      </div>
                    </div>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 text-slate-950">
                      <Clock3 className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                  <Tv className="h-5 w-5 text-cyan-300" />
                  <p className="mt-5 text-2xl font-black">0</p>
                  <p className="mt-1 text-xs text-slate-500">TVs cadastradas</p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                  <ImageUp className="h-5 w-5 text-violet-300" />
                  <p className="mt-5 text-2xl font-black">0</p>
                  <p className="mt-1 text-xs text-slate-500">Mídias publicadas</p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/15 text-amber-300"><Gift className="h-5 w-5" /></span>
                    <div>
                      <p className="text-sm font-bold text-white">Convites VIP</p>
                      <p className="text-xs text-slate-500">Chame empresas parceiras</p>
                    </div>
                  </div>
                  <strong className="text-2xl font-black text-amber-300">3</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.025] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div>
            <h2 className="text-xl font-extrabold text-white sm:text-2xl">Cadastre sua empresa agora</h2>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">O cadastro é rápido e libera seu painel gratuito por 60 dias.</p>
          </div>
          <Link href={signupHref} className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-extrabold text-slate-950 transition hover:bg-cyan-100 sm:w-auto">
            Criar minha conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section id="como-funciona" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Simples do início ao play"
            title="Como funciona em 3 passos"
            description="Da criação da conta à primeira propaganda na tela, você faz tudo com orientação dentro do painel."
          />

          <div className="relative mt-14 grid gap-4 md:grid-cols-3 md:gap-6">
            <div className="absolute left-[16%] right-[16%] top-9 hidden h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent md:block" />
            {steps.map(({ number, icon: Icon, title, text }) => (
              <article key={number} className="group relative rounded-3xl border border-white/[0.08] bg-[#0b1728] p-6 transition hover:-translate-y-1 hover:border-cyan-400/30 sm:p-8">
                <div className="mb-8 flex items-center justify-between">
                  <span className="relative z-10 grid h-16 w-16 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="text-4xl font-black text-white/[0.06]">{number}</span>
                </div>
                <h3 className="text-xl font-extrabold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">{text}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href={signupHref} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-7 font-extrabold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-300">
              Começar agora gratuitamente <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <section id="beneficios" className="scroll-mt-20 bg-[#091526] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Feito para ser fácil"
            title="Por que usar a Mídia por Mídia?"
            description="Você cuida do seu negócio. A plataforma simplifica o caminho para sua empresa aparecer mais."
          />

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl border border-white/[0.07] bg-[#07101f] p-6 sm:p-7">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/[0.09] text-cyan-300">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 text-lg font-extrabold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Transparente e sem fidelidade"
            title="Planos e Preços"
            description="Escolha a quantidade de TVs e aproveite todas as vantagens acumulativas. Mude ou cancele quando quiser."
          />

          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[0.1] px-5 py-2.5 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-cyan-300 shadow-lg shadow-cyan-500/10">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              Primeiros 60 dias 100% grátis • Sem cartão de crédito
            </div>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl border p-6 transition hover:-translate-y-1.5 ${
                  plan.popular
                    ? 'border-cyan-400/60 bg-gradient-to-b from-[#0f2842] via-[#0b1c31] to-[#071222] shadow-2xl shadow-cyan-500/20 sm:col-span-2 lg:col-span-3 xl:col-span-1'
                    : 'border-white/[0.09] bg-[#0b1728] hover:border-cyan-400/30'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                    Destaque
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-white">{plan.title}</span>
                    {plan.badge && (
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        plan.popular ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/[0.06] text-slate-300'
                      }`}>
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black tracking-tight text-white">{plan.price}</span>
                    <span className="text-xs font-semibold text-slate-400">{plan.period}</span>
                  </div>
                  {plan.additionalTv && (
                    <p className="mt-1 text-xs font-bold text-cyan-300">{plan.additionalTv}</p>
                  )}

                  <p className="mt-3 text-xs leading-5 text-slate-400">{plan.subtitle}</p>

                  {plan.includesPrevious && (
                    <div className="mt-4 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-2 text-[11px] font-extrabold text-cyan-300">
                      ✓ Inclui todas as vantagens do plano de {plan.includesPrevious} +
                    </div>
                  )}

                  <div className="my-5 h-px bg-white/[0.08]" />

                  <ul className="space-y-2.5 text-xs text-slate-300">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span className="leading-5">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 border-t border-white/[0.06] pt-4">
                  <Link
                    href={`${signupHref}?plano=${plan.id}`}
                    className={`inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl text-xs font-extrabold transition ${
                      plan.popular
                        ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-lg shadow-cyan-400/20'
                        : 'bg-white/[0.08] text-white hover:bg-white/[0.15] border border-white/10'
                    }`}
                  >
                    Testar 60 dias grátis <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Banner Indique e Ganhe */}
          <div className="mt-12 overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-amber-400/[0.05] to-transparent p-6 backdrop-blur-md sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400/20 text-amber-300 shadow-inner">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-300">
                    🎁 Programa Indique e Ganhe para Membros
                  </div>
                  <h3 className="mt-2 text-xl font-extrabold text-white">
                    Ganhe 1 Mensalidade Grátis a Cada Empresa Indicada!
                  </h3>
                  <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-300 sm:text-sm">
                    Após se tornar membro, convide outras empresas! Para <strong className="text-white">cada membro/empresa indicada</strong> em <strong className="text-white">qualquer plano</strong> que pagar a primeira mensalidade, <strong className="text-amber-300">quem indicou ganha 1 mensalidade inteiramente grátis!</strong>
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <Link
                  href={signupHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-6 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-400/15 transition hover:-translate-y-0.5 hover:bg-amber-200"
                >
                  Quero ser membro e indicar <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="convites" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-cyan-400/20 bg-gradient-to-br from-[#10273b] via-[#0b1c31] to-[#10172d] p-6 sm:p-10 lg:p-16">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Gift className="h-4 w-4" /> 3 convites VIP incluídos
              </span>
              <h2 className="mt-6 text-3xl font-black tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                Convide empresas estratégicas para crescer com você
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Chame parceiros, fornecedores, clientes ou empresas próximas para testar a plataforma por 60 dias grátis.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                Quanto mais empresas participam, maior e mais forte fica a rede de mídia local da sua cidade.
              </p>
              <Link href={signupHref} className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-6 font-extrabold text-slate-950 transition hover:-translate-y-0.5 hover:bg-amber-200 sm:w-auto">
                Começar e ganhar meus convites <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="space-y-3">
              {[
                '3 convites VIP incluídos',
                'Cada convidado recebe 60 dias grátis',
                'Sua cidade ganha uma rede de divulgação mais forte',
                'Empresas parceiras podem indicar novas empresas',
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-sm font-black text-cyan-300">{index + 1}</span>
                  <span className="text-sm font-semibold text-slate-200 sm:text-base">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#091526] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionTitle
              eyebrow="Sem espera"
              title="Você entra no painel na hora"
              description="Depois do cadastro, o sistema cria sua empresa, ativa o teste gratuito e mostra um passo a passo para colocar sua primeira propaganda na TV."
              centered={false}
            />
            <div className="mt-8 space-y-3">
              {['Empresa criada automaticamente', 'Teste de 60 dias ativado', 'Checklist para sua primeira exibição'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-semibold text-slate-300 sm:text-base">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/10 text-emerald-300"><Check className="h-3.5 w-3.5" /></span>
                  {item}
                </div>
              ))}
            </div>
            <Link href={signupHref} className="mt-9 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-7 font-extrabold text-slate-950 transition hover:bg-cyan-300 sm:w-auto">
              Acessar grátis por 60 dias <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <div className="rounded-[28px] border border-white/[0.08] bg-[#07101f] p-5 shadow-2xl shadow-black/20 sm:p-7">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-5">
              <div>
                <p className="text-xs font-semibold text-slate-500">Seu progresso</p>
                <p className="mt-1 font-extrabold text-white">Checklist inicial</p>
              </div>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-300">1 de 4</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { label: 'Empresa cadastrada', done: true },
                { label: 'Cadastrar primeira TV', done: false },
                { label: 'Enviar primeira mídia', done: false },
                { label: 'Colocar programação no ar', done: false },
              ].map(({ label, done }, index) => (
                <div key={label} className={`flex items-center gap-4 rounded-2xl border p-4 ${done ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : 'border-white/[0.06] bg-white/[0.025]'}`}>
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${done ? 'bg-emerald-400 text-slate-950' : 'bg-white/[0.06] text-slate-500'}`}>
                    {done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className={`text-sm font-semibold ${done ? 'text-slate-200' : 'text-slate-400'}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            eyebrow="Explore sem compromisso"
            title="O que você consegue fazer no teste gratuito"
          />
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {resources.map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
                <Icon className="h-5 w-5 text-cyan-300" />
                <p className="mt-4 text-sm font-bold leading-5 text-slate-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="duvidas" className="scroll-mt-20 bg-[#091526] px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionTitle eyebrow="Dúvidas frequentes" title="Tudo o que você precisa saber para começar" />
          <div className="mt-12 space-y-3">
            {faqs.map(({ question, answer }) => (
              <details key={question} className="group rounded-2xl border border-white/[0.08] bg-[#07101f] open:border-cyan-400/20">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left text-sm font-extrabold text-white sm:p-6 sm:text-base">
                  {question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180 group-open:text-cyan-300" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-6 text-slate-400 sm:px-6 sm:pb-6 sm:text-base">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-cyan-400 px-5 py-12 text-center text-slate-950 sm:px-10 sm:py-16">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/25 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Sua TV pode começar hoje</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-[-0.045em] sm:text-4xl lg:text-5xl">
              Comece hoje mesmo e coloque sua empresa para aparecer mais.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-6 text-slate-700 sm:text-base">
              Cadastre sua empresa, teste grátis por 60 dias e convide parceiros para expandir a rede de mídia da sua cidade.
            </p>
            <div className="mx-auto mt-8 flex max-w-2xl flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link href={signupHref} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-slate-800">
                Iniciar grátis agora <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href={signupHref} className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-6 font-extrabold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-50">
                Cadastrar minha empresa
              </Link>
              <Link href={signupHref} className="inline-flex min-h-12 items-center justify-center px-4 text-sm font-extrabold underline decoration-slate-700/40 underline-offset-4">
                Receber 60 dias grátis
              </Link>
              <Link href="/login" className="inline-flex min-h-12 items-center justify-center px-4 text-sm font-extrabold underline decoration-slate-700/40 underline-offset-4">
                Entrar no painel
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="contato" className="scroll-mt-20 border-t border-white/[0.07] bg-[#091526] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="space-y-4">
              <Logo />
              <p className="text-xs leading-6 text-slate-400 sm:text-sm">
                Plataforma de mídia indoor e TV corporativa. Transforme qualquer Smart TV em canal de comunicação local e monetização de publicidade.
              </p>
              <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3.5 py-1.5 text-xs font-bold text-cyan-300">
                <Building2 className="h-4 w-4" /> CNPJ: 10.764.218/0001-76
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
                <MapPin className="h-5 w-5 text-cyan-400" /> Endereço & Sede
              </h3>
              <p className="text-xs leading-6 text-slate-300 sm:text-sm">
                <strong className="text-white">Av. das Embaúbas, 2114 - Setor Comercial</strong><br />
                Sinop - MT, CEP 78550-110
              </p>
              <p className="text-xs text-slate-500">
                Atendimento presencial e suporte a empresas parceiras em Sinop-MT e em todo o Brasil.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-white">
                <Phone className="h-5 w-5 text-emerald-400" /> Contato & WhatsApp
              </h3>
              <div>
                <a
                  href="https://wa.me/5566996086030?text=Ol%C3%A1!%20Vim%20pelo%20site%20da%20M%C3%ADdia%20por%20M%C3%ADdia%20e%20gostaria%20de%20informa%C3%A7%C3%B5es."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-extrabold text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-400/20"
                >
                  <Phone className="h-4 w-4" /> Contato: (66) 99608-6030
                </a>
              </div>
              <p className="text-xs text-slate-400">
                Fale diretamente conosco pelo WhatsApp para esclarecer dúvidas ou ativar seu plano.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <Logo />
          <p className="text-xs leading-5 text-slate-500">
            © {new Date().getFullYear()} Mídia por Mídia. CNPJ 10.764.218/0001-76 • Av. das Embaúbas, 2114, Sinop-MT.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <a href="#contato" className="text-slate-400 transition hover:text-white">Contato</a>
            <Link href="/login" className="font-semibold text-slate-400 transition hover:text-white">Acessar painel</Link>
          </div>
        </div>
      </footer>
      <WhatsAppButton />
    </main>
  );
}
