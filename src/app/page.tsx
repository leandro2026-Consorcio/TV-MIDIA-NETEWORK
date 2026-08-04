import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronDown,
  CirclePlay,
  Clock3,
  Gift,
  Handshake,
  ImageUp,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Menu,
  MonitorPlay,
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

const faqs = [
  {
    question: 'Precisa de aprovação para começar?',
    answer:
      'Não. Se o cadastro público estiver habilitado, sua empresa é criada automaticamente e você já acessa o painel.',
  },
  {
    question: 'Precisa de cartão de crédito?',
    answer: 'Não. O teste gratuito de 60 dias não exige cartão.',
  },
  {
    question: 'Quanto tempo dura o teste?',
    answer: 'O teste gratuito dura 60 dias a partir do cadastro da empresa.',
  },
  {
    question: 'Posso convidar outras empresas?',
    answer:
      'Sim. Cada empresa recebe 3 convites VIP para indicar empresas estratégicas da sua rede.',
  },
  {
    question: 'Posso usar uma Smart TV?',
    answer:
      'Sim. Basta abrir o link da TV no navegador do dispositivo e fazer o pareamento pelo código.',
  },
  {
    question: 'Depois dos 60 dias, o que acontece?',
    answer:
      'Você será avisado no painel sobre o fim do período gratuito e poderá escolher um plano quando essa etapa estiver disponível.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://midiapormidia.com.br/#organization',
      name: 'Mídia por Mídia',
      alternateName: 'Rede Indoor Local',
      url: 'https://midiapormidia.com.br/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://midiapormidia.com.br/media-tv-icon.svg',
      },
      image: 'https://midiapormidia.com.br/og.png',
      description:
        'Plataforma brasileira de mídia indoor para empresas divulgarem propagandas em TVs e criarem redes locais de parceiros.',
      areaServed: {
        '@type': 'Country',
        name: 'Brasil',
      },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://midiapormidia.com.br/#website',
      url: 'https://midiapormidia.com.br/',
      name: 'Mídia por Mídia',
      alternateName: 'Rede Indoor Local',
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
        'Plataforma de mídia indoor para cadastrar TVs, publicar imagens e vídeos e divulgar empresas em redes locais.',
      provider: {
        '@id': 'https://midiapormidia.com.br/#organization',
      },
      areaServed: {
        '@type': 'Country',
        name: 'Brasil',
      },
      offers: {
        '@type': 'Offer',
        name: 'Teste gratuito por 60 dias',
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

      <footer className="border-t border-white/[0.07] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <Logo />
          <p className="text-xs leading-5 text-slate-600">
            © {new Date().getFullYear()} Mídia por Mídia. Plataforma brasileira de mídia indoor local.
          </p>
          <Link href="/login" className="text-sm font-semibold text-slate-400 transition hover:text-white">Acessar painel</Link>
        </div>
      </footer>
    </main>
  );
}
