'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Share2,
  Instagram,
  Facebook,
  CheckCircle2,
  Check,
  X,
  Building2,
  ShieldCheck,
  Sliders,
  ExternalLink,
  Music2,
} from 'lucide-react';
import {
  disconnectSocialConnectionAction,
  disconnectTikTokConnectionAction,
  setChannelParticipationAction,
} from '@/app/actions/social';
import { TikTokConnectionCard } from '@/components/social/tiktok-connection-card';

interface Props {
  user: any;
  company: any;
  channels: any[];
  socialConnectionEnabled?: boolean;
  socialMetricsEnabled?: boolean;
  tiktokConnectionEnabled?: boolean;
}

export function CompanySocialClient({
  company,
  channels,
  socialConnectionEnabled = true,
  tiktokConnectionEnabled = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const socialParam = searchParams.get('social');
    if (socialParam === 'connected') {
      setFeedback('Conta social da empresa conectada com sucesso!');
    } else if (socialParam === 'error') {
      const reason = searchParams.get('reason');
      const message = searchParams.get('message');
      if (reason === 'disabled' || reason === 'not_configured') {
        setFeedback('A conexão social ainda não está disponível no ambiente.');
      } else if (reason === 'ineligible_account') {
        setFeedback('Esta conta não é uma conta profissional ou empresarial compatível.');
      } else if (reason === 'cancelled' || reason === 'permissions') {
        setFeedback('Não recebemos todas as permissões necessárias. Tente conectar novamente.');
      } else {
        setFeedback(message || 'Não foi possível concluir a conexão agora. Tente novamente.');
      }
    }
  }, [searchParams]);

  const instagramChannels = channels.filter(
    (c) => c.provider === 'instagram' || c.channel_type === 'instagram_professional'
  );
  const facebookChannels = channels.filter(
    (c) => c.provider === 'facebook' || c.channel_type === 'facebook_page'
  );
  const tiktokChannels = channels.filter(
    (c) => c.provider === 'tiktok' || c.channel_type === 'tiktok_profile'
  );
  const hasInstagram = instagramChannels.length > 0;
  const hasFacebook = facebookChannels.length > 0;

  const instagramConnectUrl = `/api/social/meta/start?provider=instagram&owner_type=company&owner_id=${company.id}&return_to=${encodeURIComponent(`/company/social?company_id=${company.id}`)}`;
  const facebookConnectUrl = `/api/social/meta/start?provider=facebook&owner_type=company&owner_id=${company.id}&return_to=${encodeURIComponent(`/company/social?company_id=${company.id}`)}`;
  const tiktokConnectUrl = `/api/social/tiktok/start?owner_type=company&owner_id=${company.id}&return_to=${encodeURIComponent(`/company/social?company_id=${company.id}`)}`;

  const handleDisconnect = async (connId: string, provider?: string) => {
    if (!confirm('Deseja realmente desconectar esta conta das redes sociais da empresa?')) return;
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

  const handleToggleParticipation = async (channelId: string, current: boolean) => {
    setLoading(true);
    const res = await setChannelParticipationAction(channelId, !current);
    if (!res.success) {
      setFeedback(`Erro: ${res.error}`);
    } else {
      setFeedback(!current ? 'Canal ativado para veiculação.' : 'Canal pausado.');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <header className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">
              Redes Sociais da Empresa
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {company.trade_name}
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-black text-white">Canais Sociais Oficiais</h1>
          <p className="mt-1 text-xs text-slate-400">
            Conecte Instagram, Facebook e TikTok como canais independentes da empresa.
          </p>
        </div>
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-200 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* Cards de Status */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
              <Instagram className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-500">Instagram Empresa</span>
              <div className="text-base font-black text-white mt-0.5">
                {hasInstagram ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />{' '}
                    {instagramChannels[0].username ? `@${instagramChannels[0].username}` : 'Conectado'}
                  </span>
                ) : (
                  <span className="text-slate-400">Não conectado</span>
                )}
              </div>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              hasInstagram
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
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
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full ${
              hasFacebook
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {hasFacebook ? 'Ativo' : 'Pendente'}
          </span>
        </div>
      </div>

      {/* Cards de Ação de Conexão */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Card Instagram */}
        <div className="rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/20 via-slate-900 to-slate-900 p-6 sm:p-7 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-2xl bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
                <Instagram className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                Instagram Business
              </span>
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Instagram</h3>
              <p className="text-xs text-slate-300 font-semibold mt-1">Conecte sua conta profissional.</p>
              <p className="text-xs text-slate-400 mt-1">
                Conexão oficial para contas comerciais do Instagram da sua empresa. Não exige Página no Facebook.
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

        {/* Card Facebook */}
        <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-950/20 via-slate-900 to-slate-900 p-6 sm:p-7 flex flex-col justify-between space-y-6">
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
                Disponibilize a Página oficial da empresa para veiculação de anúncios no feed.
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

      {/* Canais Detectados da Empresa */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-white">Canais Conectados da Empresa</h3>

        {channels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-3">
            <Share2 className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="text-sm text-slate-400">Nenhum canal social conectado para esta empresa.</p>
            <p className="text-xs text-slate-500">
              Clique nos botões acima para autorizar o Instagram Profissional ou a Página do Facebook.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {channels.map((ch) => {
              const isFacebook = ch.provider === 'facebook';
              const isTikTok = ch.provider === 'tiktok';
              return (
                <div key={ch.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-slate-950 text-cyan-400 border border-slate-800">
                        {isFacebook ? <Facebook className="w-5 h-5" /> : isTikTok ? <Music2 className="w-5 h-5 text-cyan-400" /> : <Instagram className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">{ch.display_name}</h4>
                        <span className="text-xs text-slate-400 capitalize">
                          {ch.channel_type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      ATIVO
                    </span>
                  </div>

                  {ch.diagnostic_message && (
                    <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      {ch.diagnostic_message}
                    </p>
                  )}

                  {/* Capacidades */}
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
                      <span className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${ch.feed_publish_capable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                        {ch.feed_publish_capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Feed
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${ch.reel_publish_capable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                        {ch.reel_publish_capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Reels
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${ch.story_publish_capable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                        {ch.story_publish_capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Stories
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 ${ch.insights_capable ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>
                        {ch.insights_capable ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} Métricas
                      </span>
                    </div>}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                    <button
                      onClick={() => handleToggleParticipation(ch.id, ch.participation_enabled)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                        ch.participation_enabled
                          ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {ch.participation_enabled ? 'Pausar Participação' : 'Ativar Participação'}
                    </button>

                    <button
                      onClick={() => handleDisconnect(ch.connection_id, ch.provider)}
                      className="text-xs font-bold text-rose-400 hover:text-rose-300 underline"
                    >
                      Remover Canal
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
