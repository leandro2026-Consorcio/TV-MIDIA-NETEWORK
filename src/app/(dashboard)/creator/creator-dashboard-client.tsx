'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Share2,
  Megaphone,
  Store,
  Users,
  CircleHelp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  ExternalLink,
  Instagram,
  Facebook,
  Check,
  X,
  Sliders,
  DollarSign,
  TrendingUp,
  Award,
  Eye,
  Lock,
  Globe,
  Radio,
  RefreshCw,
  QrCode,
  Copy,
  Music2,
} from 'lucide-react';
import {
  setChannelParticipationAction,
  updateSocialChannelRulesAction,
  disconnectSocialConnectionAction,
  disconnectTikTokConnectionAction,
} from '@/app/actions/social';
import { TikTokConnectionCard } from '@/components/social/tiktok-connection-card';
import {
  setCreatorRateCardAction,
  updateCreatorProfileAction,
  respondToCampaignOfferAction,
} from '@/app/actions/creator';
import { calculateCreatorDynamicPrice } from '@/lib/mpm/creator-pricing';

interface Props {
  user: any;
  creator: any;
  affiliate: any;
  channels: any[];
  rateCards: any[];
  offers: any[];
  publications: any[];
  scoreHistory: any[];
  metricsSnapshot: any;
  subscriptions: any[];
  slots: any[];
  commissions: any[];
  entitlements: any[];
  relationship: any;
  pricingRule: any;
  masterAutoPublishEnabled: boolean;
  socialConnectionEnabled?: boolean;
  socialMetricsEnabled?: boolean;
  tiktokConnectionEnabled?: boolean;
}

const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export function CreatorDashboardClient({
  user,
  creator,
  affiliate,
  channels,
  rateCards,
  offers,
  publications,
  scoreHistory,
  metricsSnapshot,
  subscriptions,
  slots,
  commissions,
  entitlements,
  relationship,
  pricingRule,
  masterAutoPublishEnabled,
  socialConnectionEnabled = true,
  socialMetricsEnabled = false,
  tiktokConnectionEnabled = false,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'resumo' | 'social' | 'campanhas' | 'marketplace' | 'expansao' | 'ajuda'>('resumo');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form states for rate cards
  const [formatPrice, setFormatPrice] = useState<Record<string, number>>({
    feed: rateCards.find((r) => r.format === 'feed')?.price_credits || 100,
    reel: rateCards.find((r) => r.format === 'reel')?.price_credits || 150,
    story: rateCards.find((r) => r.format === 'story')?.price_credits || 50,
    package: rateCards.find((r) => r.format === 'package')?.price_credits || 250,
  });

  // Privacy states
  const [privacy, setPrivacy] = useState({
    isPublic: creator?.is_public_profile ?? true,
    showFollowers: creator?.show_followers_publicly ?? true,
    showScores: creator?.show_scores_publicly ?? true,
    showPricing: creator?.show_pricing_publicly ?? true,
    allowDirect: creator?.allow_direct_campaigns ?? true,
    pricingMode: creator?.pricing_mode ?? 'dynamic',
    slug: creator?.slug ?? `creator-${user.id.slice(0, 6)}`,
  });

  const creatorScore = Number(creator?.creator_score || 50);
  const mediaScore = Number(creator?.media_value_score || 50);

  // Tiers gamification
  const getTier = (score: number) => {
    if (score >= 85) return { name: 'Elite', next: null, min: 85 };
    if (score >= 70) return { name: 'Pro', next: 'Elite', min: 70, nextMin: 85 };
    if (score >= 50) return { name: 'Em Crescimento', next: 'Pro', min: 50, nextMin: 70 };
    return { name: 'Iniciante', next: 'Em Crescimento', min: 0, nextMin: 50 };
  };

  const tierInfo = getTier(creatorScore);

  const handleToggleParticipation = async (channelId: string, current: boolean) => {
    setLoading(true);
    setFeedback(null);
    const res = await setChannelParticipationAction(channelId, !current);
    if (!res.success) {
      setFeedback(`Erro: ${res.error}`);
    } else {
      setFeedback('Participação do canal atualizada com sucesso.');
      router.refresh();
    }
    setLoading(false);
  };

  const handleUpdateChannelMode = async (channelId: string, mode: 'manual' | 'approval' | 'automatic') => {
    setLoading(true);
    setFeedback(null);
    const res = await updateSocialChannelRulesAction({
      channelId,
      publicationMode: mode,
    });
    if (!res.success) {
      setFeedback(`Erro: ${res.error}`);
    } else {
      setFeedback(`Modo de publicação alterado para ${mode}.`);
      router.refresh();
    }
    setLoading(false);
  };

  const handleSaveRateCard = async (format: string) => {
    if (!creator?.id) return;
    setLoading(true);
    setFeedback(null);
    const res = await setCreatorRateCardAction(creator.id, format, formatPrice[format] || 50);
    if (!res.success) {
      setFeedback(`Erro ao salvar preço: ${res.error}`);
    } else {
      setFeedback(`Preço do formato ${format} atualizado.`);
      router.refresh();
    }
    setLoading(false);
  };

  const handleSavePrivacy = async () => {
    setLoading(true);
    setFeedback(null);
    const res = await updateCreatorProfileAction({
      isPublicProfile: privacy.isPublic,
      showFollowersPublicly: privacy.showFollowers,
      showScoresPublicly: privacy.showScores,
      showPricingPublicly: privacy.showPricing,
      allowDirectCampaigns: privacy.allowDirect,
      pricingMode: privacy.pricingMode as any,
      slug: privacy.slug,
    });
    if (!res.success) {
      setFeedback(`Erro ao atualizar configurações: ${res.error}`);
    } else {
      setFeedback('Configurações de perfil e privacidade salvas com sucesso.');
      router.refresh();
    }
    setLoading(false);
  };

  const handleOfferResponse = async (offerId: string, status: 'accepted' | 'refused', reason?: string) => {
    setLoading(true);
    setFeedback(null);
    const res = await respondToCampaignOfferAction(offerId, status, reason);
    if (!res.success) {
      setFeedback(`Erro: ${res.error}`);
    } else {
      setFeedback(`Proposta de campanha ${status === 'accepted' ? 'aceita' : 'recusada'}.`);
      router.refresh();
    }
    setLoading(false);
  };

  const handleDisconnect = async (connId: string, provider?: string) => {
    if (!confirm(`Deseja realmente desconectar esta conta ${provider === 'tiktok' ? 'TikTok' : 'Meta'}?`)) return;
    setLoading(true);
    const res = provider === 'tiktok'
      ? await disconnectTikTokConnectionAction(connId)
      : await disconnectSocialConnectionAction(connId);
    if (!res.success) {
      setFeedback(`Erro: ${res.error}`);
    } else {
      setFeedback('Conta desconectada com sucesso.');
      router.refresh();
    }
    setLoading(false);
  };

  const searchParams = useSearchParams();
  const instagramConnectUrl = `/api/social/meta/start?provider=instagram&owner_type=creator&owner_id=${creator?.id || ''}&return_to=${encodeURIComponent('/creator?tab=social')}`;
  const facebookConnectUrl = `/api/social/meta/start?provider=facebook&owner_type=creator&owner_id=${creator?.id || ''}&return_to=${encodeURIComponent('/creator?tab=social')}`;
  const tiktokConnectUrl = `/api/social/tiktok/start?owner_type=creator&owner_id=${creator?.id || ''}&return_to=${encodeURIComponent('/creator?tab=social')}`;

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'social') {
      setActiveTab('social');
    }
    const socialParam = searchParams.get('social');
    if (socialParam === 'connected') {
      setFeedback('Conta social conectada com sucesso!');
    } else if (socialParam === 'error') {
      const reason = searchParams.get('reason');
      const message = searchParams.get('message');
      if (reason === 'disabled' || reason === 'not_configured') {
        setFeedback('A conexão com esta rede social ainda não está disponível no ambiente.');
      } else if (reason === 'ineligible_account') {
        setFeedback('Esta conta não é uma conta profissional compatível.');
      } else if (reason === 'cancelled' || reason === 'permissions') {
        setFeedback('Não recebemos todas as permissões necessárias. Tente conectar novamente.');
      } else {
        setFeedback(message || 'Não foi possível concluir a conexão agora. Tente novamente.');
      }
    }
  }, [searchParams]);

  const instagramChannels = channels.filter((c) => c.provider === 'instagram' || c.channel_type === 'instagram_professional');
  const facebookChannels = channels.filter((c) => c.provider === 'facebook' || c.channel_type === 'facebook_page');
  const tiktokChannels = channels.filter((c) => c.provider === 'tiktok' || c.channel_type === 'tiktok_profile');
  const hasInstagram = instagramChannels.length > 0;
  const hasFacebook = facebookChannels.length > 0;
  const shareLink = affiliate ? `https://midiapormidia.com.br/?ref=${encodeURIComponent(affiliate.attribution_code)}` : '';

  return (
    <div className="max-w-7xl mx-auto space-y-7 pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-400">
              Creator Omnichannel MPM
            </span>
            {creator?.is_verified && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Verificado
              </span>
            )}
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">
            {creator?.display_name || affiliate?.display_name || 'Meu Painel Creator'}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {creator?.city ? `${creator.city}, ${creator.state} · ` : ''}
            {relationship?.affiliate_profiles?.display_name
              ? `Equipe ${relationship.affiliate_profiles.display_name}`
              : 'Rede Oficial Mídia por Mídia'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {creator?.slug && (
            <Link
              href={`/creators/${creator.slug}`}
              target="_blank"
              className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 px-3.5 py-2 text-xs font-bold text-fuchsia-300 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver Perfil Público
            </Link>
          )}
          <Link
            href="/help/getting-started"
            className="rounded-xl border border-slate-700 hover:border-slate-600 px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors"
          >
            Ajuda & Onboarding
          </Link>
        </div>
      </header>

      {/* Global Feedback Banner */}
      {feedback && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-200 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline">Fechar</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: 'resumo', label: 'Resumo & Métricas', icon: TrendingUp },
          { id: 'social', label: 'Social & Conexões', icon: Share2 },
          { id: 'campanhas', label: `Campanhas (${offers.length})`, icon: Megaphone },
          { id: 'marketplace', label: 'Marketplace & Preços', icon: Store },
          { id: 'expansao', label: 'Expansão & Indicação', icon: Users },
          { id: 'ajuda', label: 'Ajuda & Tours', icon: CircleHelp },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === id
                ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* TAB 1: RESUMO */}
      {activeTab === 'resumo' && (
        <div className="space-y-7">
          {/* Top Metrics Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <span className="text-[11px] font-bold uppercase text-slate-500">Campanhas Concluídas</span>
              <div className="text-3xl font-black text-white mt-2">
                {publications.filter((p) => p.status === 'validated').length}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">Com entrega comprovada</span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <span className="text-[11px] font-bold uppercase text-slate-500">Comissão de Expansão</span>
              <div className="text-3xl font-black text-emerald-400 mt-2">
                {money(
                  commissions
                    .filter((c) => c.status === 'available_pending_transfer')
                    .reduce((acc, c) => acc + Number(c.amount_cents || 0), 0)
                )}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">Disponível para repasse</span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <span className="text-[11px] font-bold uppercase text-slate-500">Mídia Conquistada</span>
              <div className="text-3xl font-black text-fuchsia-400 mt-2">
                {entitlements.reduce((acc, e) => acc + Number(e.insertion_quantity || 0), 0).toLocaleString('pt-BR')}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">Inserções / mês nas TVs</span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <span className="text-[11px] font-bold uppercase text-slate-500">Canais Ativos</span>
              <div className="text-3xl font-black text-cyan-400 mt-2">
                {channels.filter((c) => c.participation_enabled).length} de {channels.length}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">Conectados à rede MPM</span>
            </div>
          </div>

          {/* Gamificação & Scores */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/30 via-slate-900 to-slate-900 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">
                    Gamificação Creator
                  </span>
                  <h2 className="text-2xl font-black text-white mt-1">Tier: {tierInfo.name}</h2>
                </div>
                <div className="p-3 rounded-2xl bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                  <Award className="w-7 h-7" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-slate-300">Creator Score Atual: {creatorScore}/100</span>
                  {tierInfo.next && <span className="text-fuchsia-400">Próximo: {tierInfo.next} ({tierInfo.nextMin} pts)</span>}
                </div>
                <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, creatorScore)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-4 space-y-2.5">
                <h3 className="text-xs font-bold uppercase text-slate-400">O que eleva seu Creator Score:</h3>
                <ul className="text-xs text-slate-300 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Entrega de publicações no prazo sem atrasos.
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Manutenção dos posts publicados durante o período contratado.
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Avaliações positivas concedidas por empresas contratantes.
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    Baixo índice de recusa de campanhas recebidas.
                  </li>
                </ul>
              </div>

              <p className="text-[11px] text-slate-500">
                A pontuação e o nível de tier medem consistência técnica e operacional na rede, sem promessa ou garantia de renda.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Qualidade da Audiência
                </span>
                <h2 className="text-2xl font-black text-white mt-1">Media Value Score</h2>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-5xl font-black text-cyan-400">{mediaScore}</div>
                <div className="text-xs text-slate-400 leading-relaxed">
                  Avalia a relevância local da sua audiência, percentual de seguidores na sua cidade/região e taxa média de visualizações por publicação.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 font-bold">Seguidores</span>
                  <div className="text-lg font-black text-white mt-1">
                    {metricsSnapshot?.followers?.toLocaleString('pt-BR') || 'Aguardando'}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
                  <span className="text-[10px] uppercase text-slate-500 font-bold">Engajamento Médio</span>
                  <div className="text-lg font-black text-emerald-400 mt-1">
                    {metricsSnapshot?.engagement_rate ? `${Number(metricsSnapshot.engagement_rate).toFixed(1)}%` : 'Ótimo'}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400">
                Creators com forte concentração local em Sinop e cidades vizinhas recebem maior valorização no algoritmo de precificação MPM.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SOCIAL & CONEXÃO META */}
      {activeTab === 'social' && (
        <div className="space-y-8">
          {/* Status Geral dos Canais Sociais */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-rose-500/20 to-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30">
                  <Instagram className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500">Instagram Profissional</span>
                  <div className="text-base font-black text-white mt-0.5">
                    {hasInstagram ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> {instagramChannels[0].username ? `@${instagramChannels[0].username}` : 'Conectado'}
                      </span>
                    ) : (
                      <span className="text-slate-400">Não conectado</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${hasInstagram ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                {hasInstagram ? 'Ativo' : 'Pendente'}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Facebook className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500">Facebook Pages</span>
                  <div className="text-base font-black text-white mt-0.5">
                    {hasFacebook ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> {facebookChannels[0].display_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">Não conectado</span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${hasFacebook ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}>
                {hasFacebook ? 'Ativo' : 'Pendente'}
              </span>
            </div>
          </div>

          {/* Cards de Conexão independentes */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Card Instagram Direto */}
            <div className="rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/30 via-slate-900 to-slate-900 p-6 sm:p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                    <Instagram className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                    Instagram Direct Login
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Instagram</h3>
                  <p className="text-xs text-slate-300 font-semibold mt-1">Conecte sua conta profissional.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Compatível com contas profissionais <strong>Creator</strong> e <strong>Business</strong>. Não exige Página no Facebook vinculada.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                {hasInstagram ? (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4" /> Conectado ({instagramChannels.length} canal)
                    </span>
                    <button
                      onClick={() => handleDisconnect(instagramChannels[0].connection_id)}
                      className="text-xs font-bold text-rose-400 hover:text-rose-300 underline"
                    >
                      Desconectar
                    </button>
                  </div>
                ) : socialConnectionEnabled ? (
                  <a
                    href={instagramConnectUrl}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 px-5 py-3 text-xs font-black text-white transition-all shadow-lg shadow-fuchsia-600/20"
                  >
                    <Instagram className="w-4 h-4" /> CONECTAR INSTAGRAM
                  </a>
                ) : (
                  <div className="w-full text-center py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-amber-400">
                    Integração em homologação
                  </div>
                )}
              </div>
            </div>

            {/* Card Facebook Pages */}
            <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-950/30 via-slate-900 to-slate-900 p-6 sm:p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Facebook className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    Facebook Pages
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Facebook</h3>
                  <p className="text-xs text-slate-300 font-semibold mt-1">Conecte as Páginas que você administra.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Use para disponibilizar páginas empresariais e suas capacidades compatíveis de divulgação.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                {hasFacebook ? (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4" /> Conectado ({facebookChannels.length} páginas)
                    </span>
                    <button
                      onClick={() => handleDisconnect(facebookChannels[0].connection_id)}
                      className="text-xs font-bold text-rose-400 hover:text-rose-300 underline"
                    >
                      Desconectar
                    </button>
                  </div>
                ) : socialConnectionEnabled ? (
                  <a
                    href={facebookConnectUrl}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 px-5 py-3 text-xs font-black text-white transition-all shadow-lg shadow-blue-600/20"
                  >
                    <Facebook className="w-4 h-4" /> CONECTAR FACEBOOK
                  </a>
                ) : (
                  <div className="w-full text-center py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-amber-400">
                    Integração em homologação
                  </div>
                )}
              </div>
            </div>
            <TikTokConnectionCard
              channels={tiktokChannels}
              connectUrl={tiktokConnectUrl}
              enabled={socialConnectionEnabled && tiktokConnectionEnabled}
              loading={loading}
              onDisconnect={(connectionId) => handleDisconnect(connectionId, 'tiktok')}
            />
          </div>

          {/* Channels List */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Meus Canais Detectados</h3>

            {channels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-3">
                <Share2 className="w-10 h-10 text-slate-700 mx-auto" />
                <p className="text-sm text-slate-400">Nenhum canal Meta conectado ainda.</p>
                <p className="text-xs text-slate-500">
                  Clique no botão acima para autorizar suas Páginas do Facebook ou contas do Instagram.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {channels.map((ch) => {
                  const isFacebook = ch.provider === 'facebook';
                  const isTikTok = ch.provider === 'tiktok';
                  const diagnosticStatus = ch.diagnostic_status || 'connected';

                  const badgeColors: Record<string, { bg: string; text: string; label: string }> = {
                    connected: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', label: 'CONECTADO' },
                    ready_for_campaigns: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', label: 'PRONTO PARA CAMPANHAS' },
                    partial_permission: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', label: 'PERMISSÃO PARCIAL' },
                    expired_token: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-400', label: 'TOKEN EXPIRADO' },
                    ineligible_account: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-400', label: 'CONTA NÃO ELEGÍVEL' },
                    external_error: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-400', label: 'ERRO EXTERNO' },
                    revoked: { bg: 'bg-slate-500/10 border-slate-500/20', text: 'text-slate-400', label: 'REVOGADO' },
                  };

                  const badge = badgeColors[diagnosticStatus] || badgeColors.connected;

                  return (
                    <div
                      key={ch.id}
                      className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-5"
                    >
                      {/* Top Channel Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-2xl bg-slate-950 text-fuchsia-400 border border-slate-800">
                            {isFacebook ? <Facebook className="w-5 h-5" /> : isTikTok ? <Music2 className="w-5 h-5 text-cyan-400" /> : <Instagram className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-white">{ch.display_name}</h4>
                            <span className="text-xs text-slate-400 capitalize">
                              {ch.channel_type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Diagnostic message if any */}
                      {ch.diagnostic_message && (
                        <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                          {ch.diagnostic_message}
                        </p>
                      )}

                      {/* Capabilities Matrix */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase text-slate-500">Capacidades Detectadas:</span>
                        {isTikTok ? (
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              ['Perfil', ch.profile_read_capable],
                              ['Vídeos', ch.video_list_capable],
                              ['Upload', ch.video_upload_capable],
                              ['Direct Post', ch.direct_post_capable],
                              ['Métricas', ch.metrics_capable],
                            ].map(([label, capable]) => (
                              <span key={String(label)} className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${capable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                                {capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {label}
                              </span>
                            ))}
                          </div>
                        ) : <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                              ch.feed_publish_capable
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-950 text-slate-500 border-slate-800'
                            }`}
                          >
                            {ch.feed_publish_capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Feed
                          </span>
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                              ch.reel_publish_capable
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-950 text-slate-500 border-slate-800'
                            }`}
                          >
                            {ch.reel_publish_capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Reels
                          </span>
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                              ch.story_publish_capable
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-slate-950 text-slate-500 border-slate-800'
                            }`}
                          >
                            {ch.story_publish_capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Stories
                          </span>
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                              ch.insights_capable
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                : 'bg-slate-950 text-slate-500 border-slate-800'
                            }`}
                          >
                            {ch.insights_capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Métricas
                          </span>
                        </div>}
                      </div>

                      {/* Publication Mode Selector */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <span className="text-[11px] font-bold uppercase text-slate-500">Modo de Publicação:</span>
                        <div className="grid grid-cols-3 gap-2">
                          {(['manual', 'approval', 'automatic'] as const).map((mode) => (
                            <button
                              key={mode}
                              disabled={loading || (mode === 'automatic' && !masterAutoPublishEnabled)}
                              onClick={() => handleUpdateChannelMode(ch.id, mode)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                ch.publication_mode === mode
                                  ? 'bg-fuchsia-500 text-white border-fuchsia-400'
                                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                              } ${mode === 'automatic' && !masterAutoPublishEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              {mode === 'manual' ? 'Manual' : mode === 'approval' ? 'Aprovação' : 'Automático'}
                            </button>
                          ))}
                        </div>
                        {ch.publication_mode === 'automatic' && !masterAutoPublishEnabled && (
                          <p className="text-[10px] text-amber-400">
                            Modo automático desabilitado globalmente pela administração Master.
                          </p>
                        )}
                      </div>

                      {/* Participation & Disconnect Controls */}
                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <button
                          disabled={loading}
                          onClick={() => handleToggleParticipation(ch.id, ch.participation_enabled)}
                          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                            ch.participation_enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {ch.participation_enabled ? '✓ Participando no MPM' : 'Pausado no MPM'}
                        </button>

                        {ch.connection_id && (
                          <button
                            disabled={loading}
                          onClick={() => handleDisconnect(ch.connection_id, ch.provider)}
                            className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                          >
                            Desconectar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CAMPANHAS */}
      {activeTab === 'campanhas' && (
        <div className="space-y-7">
          <div>
            <h2 className="text-xl font-black text-white">Propostas de Campanhas Recebidas</h2>
            <p className="text-xs text-slate-400">
              Campanhas enviadas por empresas contratantes para veiculação nos seus canais.
            </p>
          </div>

          {offers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center space-y-2">
              <Megaphone className="w-10 h-10 text-slate-700 mx-auto" />
              <p className="text-sm text-slate-400">Nenhuma proposta de campanha pendente.</p>
              <p className="text-xs text-slate-500">
                Ative seu perfil no Marketplace para que empresas da sua cidade encontrem você.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {offers.map((offer) => (
                <div key={offer.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider">
                      {offer.campaigns?.companies?.trade_name || 'Empresa Anunciante'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      offer.status === 'offered'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : offer.status === 'accepted'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                    }`}>
                      {offer.status.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-white">{offer.campaigns?.name || 'Campanha'}</h4>
                    <div className="text-xl font-black text-emerald-400 mt-1">
                      {Number(offer.offered_credits).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} créditos
                    </div>
                  </div>

                  {offer.status === 'offered' && (
                    <div className="flex gap-2 pt-2">
                      <button
                        disabled={loading}
                        onClick={() => handleOfferResponse(offer.id, 'accepted')}
                        className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-2 text-xs font-black transition-colors"
                      >
                        Aceitar Campanha
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => handleOfferResponse(offer.id, 'refused', 'Indisponibilidade de agenda')}
                        className="rounded-xl border border-slate-700 hover:border-slate-600 px-3 py-2 text-xs font-bold text-slate-400 transition-colors"
                      >
                        Recusar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Histórico de Publicações */}
          {publications.length > 0 && (
            <div className="space-y-4 pt-6">
              <h3 className="text-lg font-black text-white">Histórico de Publicações e Proof of Publication</h3>
              <div className="space-y-2">
                {publications.map((pub) => (
                  <div key={pub.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">{pub.campaigns?.name || 'Publicação'}</div>
                      <div className="text-xs text-slate-400">
                        Formato: {pub.format} · Status: {pub.status} · {pub.published_at ? new Date(pub.published_at).toLocaleDateString('pt-BR') : 'Agendada'}
                      </div>
                    </div>
                    {pub.proof?.permalink && (
                      <a
                        href={pub.proof.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-fuchsia-400 hover:underline flex items-center gap-1"
                      >
                        Ver Prova <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MARKETPLACE & PREÇOS */}
      {activeTab === 'marketplace' && (
        <div className="space-y-8">
          {/* Rate Cards Config */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-black text-white">Precificação Dinâmica & Rate Cards</h2>
              <p className="text-xs text-slate-400">
                Defina o valor em Créditos MPM cobrado por formato. O valor é congelado no ato da contratação.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(['feed', 'reel', 'story', 'package'] as const).map((fmt) => {
                const dyn = calculateCreatorDynamicPrice(fmt, {
                  followers: metricsSnapshot?.followers || 5000,
                  engagementRate: Number(metricsSnapshot?.engagement_rate || 2.5),
                  localRelevance: Number(metricsSnapshot?.local_relevance || 60),
                  creatorScore,
                  mediaValueScore: mediaScore,
                });

                return (
                  <div key={fmt} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">
                        {fmt.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500">Sugerido: {dyn.suggestedPriceCredits} cr</span>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400">Seu Preço (Créditos)</label>
                      <input
                        type="number"
                        min="1"
                        value={formatPrice[fmt] || ''}
                        onChange={(e) => setFormatPrice({ ...formatPrice, [fmt]: Number(e.target.value) })}
                        className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white font-bold"
                      />
                    </div>

                    <button
                      disabled={loading}
                      onClick={() => handleSaveRateCard(fmt)}
                      className="w-full rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-2 text-xs font-bold transition-colors"
                    >
                      Salvar {fmt}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Privacy & Showcase Opt-in Controls */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 space-y-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Privacidade & Visibilidade
              </span>
              <h3 className="text-xl font-black text-white mt-1">Controles de Vitrine Pública</h3>
              <p className="text-xs text-slate-400 mt-1">
                Escolha quais informações da sua conta ficam públicas para as empresas anunciantes.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacy.isPublic}
                  onChange={(e) => setPrivacy({ ...privacy, isPublic: e.target.checked })}
                  className="rounded border-slate-700 text-fuchsia-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-white">Perfil Público no Marketplace</div>
                  <div className="text-[11px] text-slate-400">Aparecer na lista de busca de creators para empresas.</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacy.showFollowers}
                  onChange={(e) => setPrivacy({ ...privacy, showFollowers: e.target.checked })}
                  className="rounded border-slate-700 text-fuchsia-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-white">Exibir Quantidade de Seguidores</div>
                  <div className="text-[11px] text-slate-400">Permite que empresas vejam seu alcance público.</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacy.showScores}
                  onChange={(e) => setPrivacy({ ...privacy, showScores: e.target.checked })}
                  className="rounded border-slate-700 text-fuchsia-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-white">Exibir Creator Score & Media Value</div>
                  <div className="text-[11px] text-slate-400">Mostra sua nota de confiabilidade e qualidade.</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacy.showPricing}
                  onChange={(e) => setPrivacy({ ...privacy, showPricing: e.target.checked })}
                  className="rounded border-slate-700 text-fuchsia-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-white">Exibir Preço 'A partir de'</div>
                  <div className="text-[11px] text-slate-400">Exibe os valores no card público e no catálogo.</div>
                </div>
              </label>
            </div>

            <div className="pt-2">
              <label className="text-xs font-bold text-white block">URL Personalizada do seu Perfil (Slug):</label>
              <div className="mt-1 flex max-w-md items-center rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs">
                <span className="text-slate-500">midiapormidia.com.br/creators/</span>
                <input
                  type="text"
                  value={privacy.slug}
                  onChange={(e) => setPrivacy({ ...privacy, slug: e.target.value })}
                  className="bg-transparent border-0 text-fuchsia-400 font-bold focus:ring-0 p-0 ml-1 flex-1"
                />
              </div>
            </div>

            <button
              disabled={loading}
              onClick={handleSavePrivacy}
              className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-5 py-2.5 text-xs font-bold transition-colors"
            >
              Salvar Configurações de Privacidade
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: EXPANSÃO (Preservado da Etapa 1) */}
      {activeTab === 'expansao' && affiliate && (
        <div className="space-y-7">
          <section className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-bold text-white">Código do Parceiro</h2>
              <div className="mt-4 rounded-xl bg-slate-950 p-4">
                <p className="text-2xl font-black text-fuchsia-400">{affiliate.attribution_code}</p>
                <p className="mt-2 break-all text-xs text-slate-400">{shareLink}</p>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Este código registra a origem da indicação e protege sua comissão recorrente de expansão.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-white p-4 text-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareLink)}`}
                alt="QR do Código do Parceiro"
                className="mx-auto aspect-square w-full max-w-[190px]"
              />
              <p className="mt-2 text-xs font-bold text-slate-800">Escaneie para indicar empresas</p>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="font-bold text-white">Empresas e Planos Indicados</h3>
              <div className="mt-4 space-y-2">
                {subscriptions.length ? (
                  subscriptions.map((s: any) => (
                    <p key={s.id} className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">
                      {s.companies?.trade_name || 'Empresa'} · {s.expansion_plans?.name || 'Plano'} · {s.status}
                    </p>
                  ))
                ) : (
                  <p className="py-4 text-xs text-slate-500">Nenhuma indicação registrada.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="font-bold text-white">Comissões Recorrentes</h3>
              <div className="mt-4 space-y-2">
                {commissions.length ? (
                  commissions.slice(0, 10).map((c: any) => (
                    <p key={c.id} className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">
                      {c.entry_kind} · {money(c.amount_cents)} · {c.status}
                    </p>
                  ))
                ) : (
                  <p className="py-4 text-xs text-slate-500">Nenhuma comissão pendente.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 6: AJUDA & TOURS */}
      {activeTab === 'ajuda' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-black text-white">Guias e Tutoriais do Creator</h2>
            <p className="text-xs text-slate-400">
              Manuais curtos para você aproveitar ao máximo sua presença na rede Mídia por Mídia.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Como conectar Instagram', slug: 'como-conectar-instagram', desc: 'Passo a passo com login oficial da Meta.' },
              { title: 'Como conectar Facebook', slug: 'como-conectar-facebook', desc: 'Vinculação de páginas administradas.' },
              { title: 'Story e Reel automático', slug: 'story-automatico', desc: 'Como funciona a publicação pré-autorizada.' },
              { title: 'Como funciona o preço', slug: 'como-funciona-preco-creator', desc: 'Entenda o Dynamic Pricing Engine e rate cards.' },
              { title: 'Proof of Publication', slug: 'como-funciona-proof-of-publication', desc: 'Como comprovar a entrega para liberar créditos.' },
              { title: 'Creator Score & Tiers', slug: 'como-funciona-creator-score', desc: 'Como subir de Iniciante até Elite.' },
            ].map((art) => (
              <Link
                key={art.slug}
                href="/help/getting-started"
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-fuchsia-500/40 transition-colors block space-y-2"
              >
                <h4 className="font-bold text-white text-sm">{art.title}</h4>
                <p className="text-xs text-slate-400">{art.desc}</p>
                <span className="text-[11px] font-bold text-fuchsia-400 mt-2 inline-block">Ler artigo →</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
