'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CompanyAdOffer } from '@/types';
import { getMarketplaceOffersAction, getMarketplaceFiltersDataAction } from '@/app/actions/marketplace';
import {
  getMarketplaceCreatorsAction,
  getMarketplaceScreensAction,
  quoteCreatorMediaAction,
} from '@/app/actions/marketplace-omnichannel';
import {
  Store,
  Search,
  Filter,
  MapPin,
  Tag,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building2,
  Tv,
  Sparkles,
  Users,
  Eye,
  CheckCircle2,
  Star,
  ExternalLink,
  ShieldCheck,
  Check,
  Inbox,
  ShoppingCart,
  Megaphone,
} from 'lucide-react';

export default function MarketplacePage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'tvs' | 'creators' | 'offers') || 'tvs';
  const campaignId = searchParams.get('campaign_id');

  const [activeTab, setActiveTab] = useState<'tvs' | 'creators' | 'offers'>(initialTab);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [organicEntitlementBalance, setOrganicEntitlementBalance] = useState<number | null>(null);

  // Offers state
  const [offers, setOffers] = useState<CompanyAdOffer[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);

  // Creators state
  const [creators, setCreators] = useState<any[]>([]);
  const [screens, setScreens] = useState<any[]>([]);

  // Common Filters
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedSegmentId, setSelectedSegmentId] = useState('');

  // Creator specific filters
  const [selectedNiche, setSelectedNiche] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'feed' | 'reel' | 'story' | 'package' | ''>('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Quote modal state
  const [quoteCreator, setQuoteCreator] = useState<any | null>(null);
  const [quoteFormat, setQuoteFormat] = useState<'feed' | 'reel' | 'story' | 'package'>('feed');
  const [quoteQty, setQuoteQty] = useState(1);
  const [quoteFeedback, setQuoteFeedback] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const loadMarketplaceData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === 'tvs') {
        const res = await getMarketplaceScreensAction({
          search: search || undefined,
          city: selectedCity || undefined,
        });
        if (res.success) setScreens(res.screens || []);
      } else if (activeTab === 'creators') {
        const res = await getMarketplaceCreatorsAction({
          search: search || undefined,
          city: selectedCity || undefined,
          niche: selectedNiche || undefined,
          format: selectedFormat || undefined,
          verifiedOnly: verifiedOnly || undefined,
        });
        if (res.success) setCreators(res.creators || []);
      } else {
        const filtersRes = await getMarketplaceFiltersDataAction();
        if (filtersRes.success) {
          setCities(filtersRes.cities || []);
          setCompanies(filtersRes.companies || []);
          setSegments(filtersRes.segments || []);
        }

        const offersRes = await getMarketplaceOffersAction({
          search: search || undefined,
          city: selectedCity || undefined,
          companyId: selectedCompanyId || undefined,
          segmentId: selectedSegmentId || undefined,
        });

        if (offersRes.success) {
          setOffers((offersRes.offers || []) as CompanyAdOffer[]);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketplaceData();
  }, [activeTab, selectedCity, selectedCompanyId, selectedSegmentId, selectedNiche, selectedFormat, verifiedOnly]);

  useEffect(() => {
    if (!campaignId) return;
    async function loadCampaign() {
      const { data } = await (supabase.from('campaigns') as any)
        .select('id, name, description, start_date, end_date')
        .eq('id', campaignId)
        .maybeSingle();
      if (data) setSelectedCampaign(data);
    }
    loadCampaign();
  }, [campaignId, supabase]);

  useEffect(() => {
    async function loadEntitlements() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: compUsers } = await (supabase.from('company_users') as any)
          .select('company_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);
        const cid = compUsers?.[0]?.company_id;
        if (!cid) return;

        const { data: ents } = await (supabase.from('organic_benefit_media_entitlements') as any)
          .select('granted_insertions, executed_insertions, status')
          .eq('company_id', cid)
          .eq('status', 'active');

        if (ents && ents.length > 0) {
          const totalGranted = ents.reduce((acc: number, e: any) => acc + Number(e.granted_insertions || 0), 0);
          const totalExecuted = ents.reduce((acc: number, e: any) => acc + Number(e.executed_insertions || 0), 0);
          const remaining = Math.max(0, totalGranted - totalExecuted);
          setOrganicEntitlementBalance(remaining);
        }
      } catch (e) {
        console.warn('Error loading entitlements in marketplace:', e);
      }
    }
    loadEntitlements();
  }, [supabase]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMarketplaceData();
  };

  const handleRequestQuote = async () => {
    if (!quoteCreator) return;
    setQuoting(true);
    setQuoteFeedback(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setQuoteFeedback('Faça login para solicitar cotação.');
        setQuoting(false);
        return;
      }
      const { data: compUsers } = await (supabase.from('company_users') as any)
        .select('company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);

      const companyId = compUsers?.[0]?.company_id;
      if (!companyId) {
        setQuoteFeedback('Nenhuma empresa ativa vinculada à sua conta.');
        setQuoting(false);
        return;
      }

      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const key = `quote:${companyId}:${quoteCreator.id}:${quoteFormat}:${Date.now()}`;

      const res = await quoteCreatorMediaAction({
        buyerCompanyId: companyId,
        creatorId: quoteCreator.id,
        format: quoteFormat,
        quantity: quoteQty,
        startsAt,
        endsAt,
        idempotencyKey: key,
      });

      if (!res.success) {
        setQuoteFeedback(`Erro: ${res.error}`);
      } else {
        setQuoteFeedback(`✓ Cotação gerada com preço congelado: ${res.data?.gross_credits} créditos (${res.data?.unit_price_credits} cr/unidade).`);
      }
    } catch (err: any) {
      setQuoteFeedback(`Erro: ${err.message}`);
    } finally {
      setQuoting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Contextual Banner: Distribuição de Campanha */}
      {selectedCampaign && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Distribuição da Minha Empresa</span>
              <strong className="text-white text-base font-bold">Você está distribuindo a campanha: {selectedCampaign.name}</strong>
              <p className="text-xs text-slate-300 mt-0.5">
                Escolha abaixo as TVs comerciais parceiras ou canais de Creators para veicular seus anúncios.
              </p>
            </div>
          </div>
          <Link
            href={`/campaigns/${selectedCampaign.id}`}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-bold text-slate-200 transition shrink-0"
          >
            Voltar para a Campanha
          </Link>
        </div>
      )}

      {/* Contextual Banner: Saldo de Direito de Divulgação Orgânica */}
      {organicEntitlementBalance !== null && organicEntitlementBalance > 0 && (
        <div className="bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-slate-900 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 block">Direito de Divulgação Orgânica Reconhecido</span>
              <p className="text-xs text-slate-200 mt-0.5">
                Saldo disponível: <strong className="text-purple-200 font-mono text-sm">{organicEntitlementBalance.toLocaleString('pt-BR')} unidades equivalentes</strong> (gerado por seus Benefícios & Prêmios).
              </p>
              <span className="text-[10px] text-purple-400/80 block mt-0.5">
                Pesos por tela: TV Comercial (1,00) · Monitor Windows (0,10) · Residencial (0,01)
              </span>
            </div>
          </div>
          <Link
            href="/benefits"
            className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 text-xs font-bold text-purple-200 transition shrink-0"
          >
            Ver Meus Benefícios
          </Link>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/20 p-2.5 rounded-2xl text-purple-400 border border-purple-500/30">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider block">
              Marketplace Omnichannel MPM
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Vitrine de TVs Indoor & Creators
            </h1>
          </div>
        </div>
        <p className="text-slate-400 text-xs sm:text-sm max-w-2xl">
          Contrate espaços de exibição em TVs comerciais da sua cidade ou campanhas em redes sociais com Creators verificados.
        </p>

        {/* Tab Navigation & Subnav de Gestão de Mídia */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('tvs')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'tvs'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-slate-400 hover:text-white bg-slate-950/60'
              }`}
            >
              <Tv className="w-4 h-4" /> TVs & Telas Indoor
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'creators'
                  ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/20'
                  : 'text-slate-400 hover:text-white bg-slate-950/60'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Creators & Redes Sociais
            </button>
            <button
              onClick={() => setActiveTab('offers')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === 'offers'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white bg-slate-950/60'
              }`}
            >
              <Tag className="w-4 h-4" /> Planos de Mídia da Rede
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 sm:pb-0">
            <Link
              href="/media-requests"
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-1.5 whitespace-nowrap text-[11px]"
            >
              <Inbox className="w-3.5 h-3.5 text-purple-400" />
              <span>Solicitações</span>
            </Link>
            <Link
              href="/ad-offer-orders"
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-1.5 whitespace-nowrap text-[11px]"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
              <span>Pedidos</span>
            </Link>
            <Link
              href="/ad-offers"
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-1.5 whitespace-nowrap text-[11px]"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              <span>Minhas Ofertas</span>
            </Link>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === 'tvs'
                  ? 'Buscar por nome da tela, estabelecimento ou cidade...'
                  : activeTab === 'creators'
                    ? 'Buscar por nome do creator, nicho ou cidade...'
                    : 'Buscar por título do plano ou empresa...'
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-lg shadow-purple-600/20"
          >
            Buscar
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: TVs & Telas Indoor */}
      {activeTab === 'tvs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Telas Comerciais Disponíveis</h2>
            <Link
              href="/onde-anunciar"
              className="text-xs font-bold text-purple-400 hover:underline flex items-center gap-1"
            >
              Ver mapa completo de locais →
            </Link>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
            </div>
          ) : screens.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
              <Tv className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">Nenhuma tela encontrada</h3>
              <p className="text-xs text-slate-400">Tente ajustar o termo de busca.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {screens.map((screen) => (
                <div
                  key={screen.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                        {screen.venueCategory}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400">● Online</span>
                    </div>

                    <h3 className="text-base font-bold text-white line-clamp-1">{screen.name}</h3>

                    <p className="text-xs text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      {screen.companyName}
                    </p>

                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {screen.city}, {screen.state}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase">Inserção a partir de</span>
                      <span className="text-sm font-black text-purple-400">
                        {screen.indicativePriceCredits} crédito
                      </span>
                    </div>

                    <Link
                      href={campaignId ? `/campaigns/new?screen=${screen.id}&campaign_id=${campaignId}` : `/campaigns/new?screen=${screen.id}`}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition"
                    >
                      Contratar TV
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Creators & Redes Sociais */}
      {activeTab === 'creators' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">Creators & Redes Verificadas</h2>
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="rounded border-slate-700 text-fuchsia-500 focus:ring-0"
                />
                Apenas Verificados
              </label>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400 mx-auto" />
            </div>
          ) : creators.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
              <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">Nenhum creator encontrado</h3>
              <p className="text-xs text-slate-400">Tente ajustar seus filtros de nicho ou cidade.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {creators.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-fuchsia-500/40 transition"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-pink-500 p-0.5 shadow-md shrink-0">
                          {c.avatarUrl ? (
                            <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full object-cover rounded-[10px]" />
                          ) : (
                            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-xs font-bold text-fuchsia-300">
                              {c.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <h3 className="text-sm font-bold text-white line-clamp-1">{c.displayName}</h3>
                            {c.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-500" /> {c.city || 'Regional'}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                        {c.tier || 'Starter'}
                      </span>
                    </div>

                    {c.niches?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.niches.slice(0, 3).map((n: string) => (
                          <span key={n} className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                            #{n}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                      <div>
                        <span className="text-[9px] uppercase text-slate-500 block">Creator Score</span>
                        <strong className="text-white font-bold">{c.creatorScore ? `${c.creatorScore}/100` : '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-slate-500 block">Seguidores</span>
                        <strong className="text-white font-bold">{c.followers ? c.followers.toLocaleString('pt-BR') : '—'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase">A partir de</span>
                      <strong className="text-xs font-black text-fuchsia-400">
                        {c.minPriceCredits ? `${c.minPriceCredits} cr` : 'Sob cotação'}
                      </strong>
                    </div>

                    <div className="flex gap-1.5">
                      {c.slug && (
                        <Link
                          href={`/creators/${c.slug}`}
                          target="_blank"
                          className="rounded-xl border border-slate-700 hover:border-slate-600 px-2.5 py-1.5 text-xs text-slate-300"
                        >
                          Perfil
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setQuoteCreator(c);
                          setQuoteFeedback(null);
                        }}
                        className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-1.5 text-xs font-bold transition-colors"
                      >
                        Cotar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Ofertas Legadas da Rede */}
      {activeTab === 'offers' && (
        <div className="space-y-6">
          <h2 className="text-xl font-black text-white">Planos de Mídia em TVs Locais</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {offers.length === 0 ? (
              <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <Store className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">Nenhum plano de mídia encontrado</h3>
              </div>
            ) : (
              offers.map((offer: any) => (
                <div
                  key={offer.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl hover:border-purple-500/40 transition group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-purple-400 block truncate max-w-[180px]">
                        {offer.company?.trade_name || 'Empresa Exibidora'}
                      </span>
                      <span className="text-[11px] text-amber-400 font-mono font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
                        {offer.credits_amount} CR
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition">{offer.title}</h3>
                    {offer.description && <p className="text-xs text-slate-400 line-clamp-2">{offer.description}</p>}

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{offer.company?.city || 'Localidade não informada'}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-mono">PREÇO DO PLANO</span>
                      <strong className="text-base font-extrabold text-white font-mono">
                        R$ {(offer.price_cents / 100).toFixed(2)}
                      </strong>
                    </div>

                    <Link
                      href={`/marketplace/${offer.id}`}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
                    >
                      Ver Detalhes <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Cotação de Creator */}
      {quoteCreator && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase text-purple-400">Cotação Congelada MPM</span>
                <h3 className="text-lg font-black text-white">{quoteCreator.displayName}</h3>
              </div>
              <button
                onClick={() => setQuoteCreator(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Formato de Publicação:</label>
                <select
                  value={quoteFormat}
                  onChange={(e) => setQuoteFormat(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                >
                  <option value="feed">Feed (Post com imagem/vídeo)</option>
                  <option value="reel">Reel (Vídeo vertical dinâmico)</option>
                  <option value="story">Story (Temporário 24h)</option>
                  <option value="package">Pacote Completo (Feed + Stories)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Quantidade de Publicações:</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={quoteQty}
                  onChange={(e) => setQuoteQty(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              {quoteFeedback && (
                <p className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
                  {quoteFeedback}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                disabled={quoting}
                onClick={handleRequestQuote}
                className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 text-xs transition"
              >
                {quoting ? 'Calculando...' : 'Gerar Cotação Congelada'}
              </button>
              <button
                onClick={() => setQuoteCreator(null)}
                className="rounded-xl border border-slate-700 hover:border-slate-600 px-4 py-2.5 text-xs font-bold text-slate-300"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
