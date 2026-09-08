import Link from 'next/link';
import {
  Building2,
  Tv,
  Sparkles,
  MapPin,
  Gift,
  ArrowRight,
  ShieldCheck,
  Star,
  Users,
  Megaphone,
} from 'lucide-react';

interface ShowcaseData {
  metrics: {
    total_companies: number;
    total_public_screens: number;
    cities_count: number;
    cities: string[];
  };
  companies: Array<{
    id: string;
    name: string;
    logo_url: string | null;
    city: string | null;
    state: string | null;
    public_screens_count: number | null;
  }>;
  creators: Array<{
    id: string;
    display_name: string;
    slug: string | null;
    avatar_url: string | null;
    city: string | null;
    state: string | null;
    niches: string[];
    tier: string | null;
    followers: number | null;
    creator_score: number | null;
    media_value_score: number | null;
    min_price_credits: number | null;
  }>;
  rewards: Array<{
    id: string;
    title: string;
    description: string | null;
    credits_required: number;
    quantity_available: number;
    company_name: string;
  }>;
  locations: Array<{
    id: string;
    name: string;
    venue_type: string;
    venue_category: string | null;
    company_name: string;
    city: string;
    state: string;
    indicative_price_credits: number;
  }>;
}

export function PublicShowcaseSection({ data }: { data: ShowcaseData }) {
  const metrics = data?.metrics || { total_companies: 0, total_public_screens: 0, cities_count: 0, cities: [] };
  const companies = data?.companies || [];
  const creators = data?.creators || [];
  const rewards = data?.rewards || [];

  return (
    <section id="vitrine" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8 border-t border-white/[0.06] bg-[#07101f]">
      <div className="mx-auto max-w-7xl space-y-20">
        {/* Header & Rede MPM Stats */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
            Vitrine Dinâmica da Rede
          </p>
          <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
            A força da mídia local conectada
          </h2>
          <p className="text-base text-slate-400">
            Dados reais da rede atualizados pelo banco de dados: telas ativas, empresas parceiras e creators regionais.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-left">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0b1728] p-5">
              <span className="text-[11px] font-bold uppercase text-slate-500">Empresas Participantes</span>
              <div className="text-3xl font-black text-white mt-1">{metrics.total_companies}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#0b1728] p-5">
              <span className="text-[11px] font-bold uppercase text-slate-500">Telas no Ar</span>
              <div className="text-3xl font-black text-cyan-300 mt-1">{metrics.total_public_screens}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#0b1728] p-5">
              <span className="text-[11px] font-bold uppercase text-slate-500">Cidades na Rede</span>
              <div className="text-3xl font-black text-emerald-400 mt-1">{metrics.cities_count}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#0b1728] p-5">
              <span className="text-[11px] font-bold uppercase text-slate-500">Creators Ativos</span>
              <div className="text-3xl font-black text-fuchsia-400 mt-1">{creators.length}</div>
            </div>
          </div>
        </div>

        {/* Empresas Participantes (Opt-in do Banco) */}
        {companies.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Empresas Participantes</h3>
                <p className="text-xs text-slate-400">Estabelecimentos com visibilidade pública autorizada na rede.</p>
              </div>
              <Link href="/empresa/cadastro" className="text-xs font-bold text-cyan-400 hover:underline">
                Cadastrar minha empresa →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {companies.map((comp) => (
                <div
                  key={comp.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#0b1728] p-4 text-center space-y-2 flex flex-col items-center justify-center min-h-[120px] hover:border-cyan-400/30 transition-colors"
                >
                  {comp.logo_url ? (
                    <img src={comp.logo_url} alt={comp.name} className="h-10 w-10 object-contain rounded-lg" />
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-cyan-400/10 text-cyan-300 flex items-center justify-center font-black text-sm">
                      {comp.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-bold text-white line-clamp-1">{comp.name}</span>
                  {comp.city && <span className="text-[10px] text-slate-500">{comp.city}</span>}
                  {comp.public_screens_count !== null && comp.public_screens_count > 0 && (
                    <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full">
                      {comp.public_screens_count} {comp.public_screens_count === 1 ? 'TV' : 'TVs'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creators em Destaque */}
        {creators.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Creators Regionais em Destaque</h3>
                <p className="text-xs text-slate-400">Perfis verificados prontos para campanhas patrocinadas.</p>
              </div>
              <Link href="/marketplace?tab=creators" className="text-xs font-bold text-fuchsia-400 hover:underline">
                Ver todos os creators →
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {creators.map((c) => (
                <div
                  key={c.id}
                  className="rounded-3xl border border-white/[0.08] bg-[#0b1728] p-5 space-y-4 hover:border-fuchsia-400/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-pink-500 p-0.5 shadow-md shrink-0">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.display_name} className="w-full h-full object-cover rounded-[14px]" />
                        ) : (
                          <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-xs font-black text-fuchsia-300">
                            {c.display_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white line-clamp-1">{c.display_name}</h4>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" /> {c.city || 'Regional'}
                        </span>
                      </div>
                    </div>

                    {c.niches?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.niches.slice(0, 2).map((n) => (
                          <span key={n} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-400 border border-white/[0.06]">
                            #{n}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] border-t border-white/[0.06]">
                      {c.followers !== null && (
                        <div>
                          <span className="text-[10px] text-slate-500 block">Seguidores</span>
                          <strong className="text-white">{c.followers.toLocaleString('pt-BR')}</strong>
                        </div>
                      )}
                      {c.creator_score !== null && (
                        <div>
                          <span className="text-[10px] text-slate-500 block">Creator Score</span>
                          <strong className="text-amber-300">{Number(c.creator_score).toFixed(0)}/100</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">A partir de</span>
                      <strong className="text-xs font-black text-fuchsia-400">
                        {c.min_price_credits ? `${c.min_price_credits} cr` : 'Sob cotação'}
                      </strong>
                    </div>

                    <Link
                      href={c.slug ? `/creators/${c.slug}` : `/marketplace?creator=${c.id}`}
                      className="rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500 text-fuchsia-300 hover:text-white px-3 py-1.5 text-xs font-bold transition-all"
                    >
                      Ver Perfil
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Catálogo Real de Benefícios da Rede */}
        {rewards.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Catálogo Real de Benefícios & Prêmios</h3>
                <p className="text-xs text-slate-400">Recompensas ativas disponibilizadas por empresas da Rede Orgânica.</p>
              </div>
              <Link href="/organic-rewards" className="text-xs font-bold text-amber-400 hover:underline">
                Ver todos os benefícios →
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((rw) => (
                <div key={rw.id} className="rounded-3xl border border-amber-400/20 bg-[#0b1728] p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Gift className="w-4 h-4" /> {rw.company_name}
                    </span>
                    <span className="text-xs text-slate-400">{rw.quantity_available} disponíveis</span>
                  </div>

                  <h4 className="text-base font-bold text-white">{rw.title}</h4>
                  {rw.description && <p className="text-xs text-slate-400 line-clamp-2">{rw.description}</p>}

                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-base font-black text-amber-400">
                      {Number(rw.credits_required).toFixed(2)} créditos
                    </span>
                    <Link
                      href="/organic"
                      className="rounded-xl bg-amber-400/20 hover:bg-amber-400 hover:text-slate-950 text-amber-300 px-3 py-1.5 text-xs font-bold transition-all"
                    >
                      Resgatar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Onde Anunciar: TVs e Creators */}
        <div className="grid md:grid-cols-2 gap-6 pt-4">
          <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/20 to-[#0b1728] p-8 space-y-4">
            <div className="p-3 rounded-2xl bg-cyan-400/10 text-cyan-300 w-fit">
              <Tv className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-white">Anuncie em TVs Indoor</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Exiba sua marca nas telas comerciais de clínicas, academias, restaurantes e comércios da sua cidade com comprovação auditada por Proof of Delivery.
            </p>
            <Link
              href="/onde-anunciar"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 px-5 py-2.5 text-xs font-extrabold transition-all"
            >
              Ver Locais no Mapa <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-950/20 to-[#0b1728] p-8 space-y-4">
            <div className="p-3 rounded-2xl bg-fuchsia-400/10 text-fuchsia-300 w-fit">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-white">Anuncie com Creators</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Encontre influenciadores com audiência comprovada na sua região. Preço congelado no momento da cotação e postagem garantida com Proof of Publication.
            </p>
            <Link
              href="/marketplace?tab=creators"
              className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-white px-5 py-2.5 text-xs font-extrabold transition-all"
            >
              Explorar Marketplace de Creators <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 4 CTAs Centrais Obrigatórios da Etapa 2 */}
        <div className="rounded-3xl border border-white/[0.08] bg-[#0b1728] p-8 sm:p-12 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h3 className="text-2xl sm:text-3xl font-black text-white">Faça parte do ecossistema MPM</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Escolha a melhor forma de se conectar à nossa rede omnichannel.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/marketplace"
              className="group rounded-2xl border border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/10 p-5 space-y-3 transition-all flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold uppercase text-cyan-300 tracking-wider">Empresa Compradora</span>
                <h4 className="text-base font-black text-white group-hover:text-cyan-300 transition-colors mt-1">
                  Quero anunciar
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Lance campanhas em TVs comerciais e redes sociais com orçamento sob medida.
                </p>
              </div>
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                Ir ao Marketplace <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/empresa/cadastro"
              className="group rounded-2xl border border-purple-400/30 bg-purple-400/5 hover:bg-purple-400/10 p-5 space-y-3 transition-all flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold uppercase text-purple-300 tracking-wider">Ponto de Mídia</span>
                <h4 className="text-base font-black text-white group-hover:text-purple-300 transition-colors mt-1">
                  Quero colocar uma TV
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Conecte a TV da sua empresa, exiba sua mídia e monetize o tempo ocioso.
                </p>
              </div>
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                Cadastrar TV <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/register?role=creator"
              className="group rounded-2xl border border-fuchsia-400/30 bg-fuchsia-400/5 hover:bg-fuchsia-400/10 p-5 space-y-3 transition-all flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold uppercase text-fuchsia-300 tracking-wider">Influenciador</span>
                <h4 className="text-base font-black text-white group-hover:text-fuchsia-300 transition-colors mt-1">
                  Quero ser Creator Parceiro
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Conecte suas redes, receba score de qualidade e seja contratado por marcas.
                </p>
              </div>
              <span className="text-xs font-bold text-fuchsia-300 flex items-center gap-1">
                Cadastrar Perfil <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <Link
              href="/leader"
              className="group rounded-2xl border border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/10 p-5 space-y-3 transition-all flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-300 tracking-wider">Líder Regional</span>
                <h4 className="text-base font-black text-white group-hover:text-amber-300 transition-colors mt-1">
                  Quero liderar uma equipe
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Coordene creators e empresas da sua região e receba comissões de expansão.
                </p>
              </div>
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                Ver Programa de Líderes <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
