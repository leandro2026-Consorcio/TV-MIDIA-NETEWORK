'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Gift,
  Laptop,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Tv,
  Wallet,
  Sparkles,
  Pin,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  MapPin,
  Calendar
} from 'lucide-react';
import {
  activateOrganicParticipantAction,
  createOrganicScreenAction,
  getOrganicDashboardAction,
  pairOrganicScreenAction,
  reserveOrganicRewardAction,
  pinOrganicRewardAction
} from '@/app/actions/organic-network';

export default function OrganicNetworkPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState({ displayName: '', city: '', state: 'MT' });
  const [screen, setScreen] = useState({
    name: '',
    deviceType: 'organic_tv' as 'organic_tv' | 'organic_windows_monitor',
    idleMinutes: 5,
  });
  const [pairing, setPairing] = useState<Record<string, string>>({});
  const [redemptionCode, setRedemptionCode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getOrganicDashboardAction();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const result = await activateOrganicParticipantAction(profile);
    setMessage(result.success ? 'Participação na Rede Orgânica ativada com sucesso!' : result.error || 'Falha ao ativar.');
    setBusy(false);
    if (result.success) await load();
  };

  const addScreen = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const result = await createOrganicScreenAction({
      name: screen.name,
      deviceType: screen.deviceType,
      idleStartSeconds: screen.idleMinutes * 60,
    });
    setMessage(
      result.success
        ? 'Tela criada. Abra /organic-tv no dispositivo e informe o código de pareamento.'
        : result.error || 'Falha ao criar tela.'
    );
    setBusy(false);
    if (result.success) {
      setScreen({ ...screen, name: '' });
      await load();
    }
  };

  const pair = async (screenId: string) => {
    setBusy(true);
    setMessage('');
    const result = await pairOrganicScreenAction(screenId, pairing[screenId] || '');
    setMessage(result.success ? 'Tela pareada e pronta para veicular!' : result.error || 'Falha no pareamento.');
    setBusy(false);
    if (result.success) await load();
  };

  const reserve = async (rewardId: string) => {
    setBusy(true);
    setMessage('');
    const result = await reserveOrganicRewardAction(rewardId);
    if (result.success) {
      setRedemptionCode(result.code);
      setMessage('Benefício reservado com sucesso! Apresente o código no estabelecimento.');
      await load();
    } else {
      setMessage(result.error || 'Não foi possível reservar.');
    }
    setBusy(false);
  };

  const pinReward = async (rewardId: string) => {
    setBusy(true);
    setMessage('');
    const result = await pinOrganicRewardAction(rewardId);
    if (result.success) {
      setMessage('Prêmio fixado como seu objetivo principal!');
      await load();
    } else {
      setMessage(result.error || 'Não foi possível fixar o prêmio.');
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!data?.participant) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Rede Orgânica MPM</span>
          <h1 className="mt-1 text-3xl font-black text-white">Ativar Minha Participação</h1>
          <p className="mt-2 text-slate-400">
            Disponibilize sua TV ou Monitor Windows quando estiver sem uso e acumule Pontos da Rede para trocar por benefícios locais.
          </p>
        </div>
        <form onSubmit={activate} className="space-y-4 rounded-3xl border border-amber-400/20 bg-slate-900 p-7">
          <label className="block text-xs font-bold text-slate-400">
            Seu Nome Completo *
            <input
              required
              placeholder="Ex.: Carlos Silva"
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_100px]">
            <label className="block text-xs font-bold text-slate-400">
              Cidade *
              <input
                required
                placeholder="Sua cidade"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              />
            </label>
            <label className="block text-xs font-bold text-slate-400">
              Estado *
              <input
                required
                maxLength={2}
                value={profile.state}
                onChange={(e) => setProfile({ ...profile, state: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase text-white font-mono"
              />
            </label>
          </div>
          <label className="flex items-start gap-3 text-xs text-slate-300 pt-2">
            <input required type="checkbox" className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-400" />
            <span>
              Concordo em disponibilizar minha tela para Exibições Validadas na Rede Orgânica e acumular Pontos da Rede conforme as diretrizes da comunidade.
            </span>
          </label>
          <button
            disabled={busy}
            className="w-full rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-40"
          >
            {busy ? 'Ativando...' : 'Ativar Minha Participação na Rede Orgânica'}
          </button>
        </form>
      </div>
    );
  }

  const p = data.participant;
  const pinned = data.pinnedReward;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Rede Orgânica MPM</span>
          <h1 className="mt-0.5 text-3xl font-black text-white">Minha Rede Orgânica</h1>
          <p className="mt-1 text-sm text-slate-400">
            Conecte sua TV ou Monitor Windows e acumule Pontos da Rede para resgatar prêmios e experiências locais.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-medium text-amber-200">
          {message}
        </div>
      )}

      {/* Redemption Code Banner */}
      {redemptionCode && (
        <div className="rounded-3xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-slate-900 p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎁</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Cupom Reservado com Sucesso</p>
              <h3 className="mt-0.5 text-lg font-black text-white">Apresente este código no caixa da loja:</h3>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-slate-950 p-4 text-center">
            <span className="font-mono text-4xl font-black tracking-widest text-emerald-400">{redemptionCode}</span>
            <p className="mt-1 text-xs text-slate-400">Guarde seu código ou acesse a aba Prêmios Orgânicos para ver seu cupom.</p>
          </div>
        </div>
      )}

      {/* Summary KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Seus Pontos da Rede</span>
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>
          <strong className="mt-3 block font-mono text-3xl font-black text-white">
            {Number(p.available_balance || 0).toFixed(0)}{' '}
            <span className="text-sm font-normal text-amber-300">pontos</span>
          </strong>
          <span className="mt-1 block text-xs text-slate-400">Saldo disponível para resgates</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Hoje</span>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <strong className="mt-3 block font-mono text-3xl font-black text-emerald-400">
            +{Number(data.todayStats?.pointsEarned || 0).toFixed(2)}{' '}
            <span className="text-sm font-normal text-slate-400">pts</span>
          </strong>
          <span className="mt-1 block text-xs text-slate-400">
            {data.todayStats?.validatedDisplays || 0} Exibições Validadas hoje
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Telas Conectadas</span>
            <MonitorPlay className="h-5 w-5 text-cyan-400" />
          </div>
          <strong className="mt-3 block font-mono text-3xl font-black text-white">
            {data.screens.length}{' '}
            <span className="text-sm font-normal text-slate-400">ativas</span>
          </strong>
          <span className="mt-1 block text-xs text-slate-400">0,05 pts por exibição (06:00–23:59)</span>
        </div>
      </div>

      {/* FEATURED: MEU PRÓXIMO PRÊMIO */}
      {pinned && (
        <section className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="rounded-xl bg-amber-400/20 p-2 text-amber-300">
                <Gift className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Objetivo em Andamento
                </span>
                <h2 className="text-xl font-black text-white">MEU PRÓXIMO PRÊMIO</h2>
              </div>
            </div>

            {pinned.totalBonus > 0 && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300 font-mono">
                BÔNUS DA EMPRESA: +{pinned.totalBonus}%
              </span>
            )}
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_.8fr]">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400">{pinned.companyTradeName}</span>
                <h3 className="text-2xl font-black text-white">{pinned.title}</h3>
                {pinned.city && <p className="text-xs text-slate-500">{pinned.city}</p>}
                {pinned.description && (
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">{pinned.description}</p>
                )}
              </div>

              {/* Progress Bar & Milestones */}
              <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Progresso do Prêmio</span>
                  <span className="font-mono text-base font-black text-amber-400">
                    {pinned.progressPercent}%
                  </span>
                </div>

                <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      pinned.progressPercent >= 100
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400'
                    }`}
                    style={{ width: `${pinned.progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="text-amber-300 font-medium">{pinned.milestoneMessage}</span>
                  <span>
                    Meta Líquida: <strong>{pinned.netPointsRequired} pts</strong> (Base: {pinned.basePoints} pts)
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-400">
                {pinned.totalBonus > 0 ? (
                  <p>
                    Com o <strong>Bônus de {pinned.totalBonus}%</strong> oferecido pela empresa, você só precisa de{' '}
                    <strong className="text-white">{pinned.netPointsRequired} Pontos da Rede</strong> para resgatar este benefício.
                  </p>
                ) : (
                  <p>
                    Mantenha sua tela ativa para acumular os <strong>{pinned.basePoints} Pontos da Rede</strong> necessários para o resgate.
                  </p>
                )}
              </div>
            </div>

            {/* Action Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950 p-6">
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Status de Liberação
                </span>
                {pinned.isReadyToRedeem ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
                    <p className="font-bold">Parabéns! Pontuação alcançada!</p>
                    <p className="mt-0.5 text-emerald-400/80">
                      Você já tem pontos suficientes para resgatar este prêmio agora mesmo.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 text-xs text-slate-400">
                    <p>Faltam {Math.max(0, pinned.netPointsRequired - Number(p.available_balance || 0))} pontos para liberar o resgate.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  disabled={busy || !pinned.isReadyToRedeem}
                  onClick={() => void reserve(pinned.id)}
                  className={`w-full rounded-xl py-3 text-sm font-black transition ${
                    pinned.isReadyToRedeem
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  {pinned.isReadyToRedeem ? 'RESGATAR AGORA' : 'RESGATAR BENEFÍCIO'}
                </button>
                <a
                  href="/organic-rewards"
                  className="block text-center text-xs font-bold text-amber-400 hover:text-amber-300 pt-1"
                >
                  Ver todos os prêmios disponíveis →
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Screen Management Section */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Add Screen Form */}
        <form onSubmit={addScreen} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400">
              <MonitorPlay className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-white">Adicionar Tela Orgânica</h2>
              <p className="text-xs text-slate-400">TV ou Monitor Windows doméstico sem uso comercial.</p>
            </div>
          </div>

          <label className="block text-xs font-bold text-slate-400">
            Nome ou Identificação da Tela *
            <input
              required
              placeholder="Ex.: TV da Sala, Monitor Quarto"
              value={screen.name}
              onChange={(e) => setScreen({ ...screen, name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setScreen({ ...screen, deviceType: 'organic_tv' })}
              className={`rounded-xl border p-3.5 text-left transition ${
                screen.deviceType === 'organic_tv'
                  ? 'border-cyan-400 bg-cyan-400/10 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="h-5 w-5 mb-1 text-cyan-400" />
              <strong className="block text-xs">Smart TV</strong>
              <span className="text-[10px] text-slate-500">Navegador da TV (/organic-tv)</span>
            </button>

            <button
              type="button"
              onClick={() => setScreen({ ...screen, deviceType: 'organic_windows_monitor' })}
              className={`rounded-xl border p-3.5 text-left transition ${
                screen.deviceType === 'organic_windows_monitor'
                  ? 'border-violet-400 bg-violet-400/10 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <Laptop className="h-5 w-5 mb-1 text-violet-400" />
              <strong className="block text-xs">Monitor Windows</strong>
              <span className="text-[10px] text-slate-500">Proteção de tela inativa</span>
            </button>
          </div>

          {screen.deviceType === 'organic_windows_monitor' && (
            <div className="rounded-2xl border border-violet-500/20 bg-violet-400/10 p-4 text-xs text-violet-200 space-y-2">
              <p className="font-bold text-white">Instalador Nativo MPM para Windows (10 e 11)</p>
              <p className="text-violet-300/80 leading-relaxed">
                Inicia automaticamente quando o computador fica ocioso e fecha sozinho ao mover o mouse.
              </p>
              <a
                href={`/downloads/mpm-player/windows?mode=organic&idle=${screen.idleMinutes}`}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-600 transition shadow-md shadow-violet-500/20"
              >
                <Download className="h-3.5 w-3.5" /> Baixar Instalador MPM Windows (.exe)
              </a>
            </div>
          )}

          <label className="block text-xs font-bold text-slate-400">
            Iniciar após inatividade (minutos)
            <input
              type="number"
              min={1}
              max={1440}
              value={screen.idleMinutes}
              onChange={(e) => setScreen({ ...screen, idleMinutes: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white font-mono"
            />
          </label>

          <button
            disabled={busy}
            className="w-full rounded-xl bg-cyan-400 px-5 py-3 text-xs font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"
          >
            Cadastrar Tela
          </button>
        </form>

        {/* Screens List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Minhas Telas Cadastradas</h2>
            <span className="text-xs text-slate-400">{data.screens.length} ativas</span>
          </div>

          {data.screens.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-500">
              <Tv className="mx-auto h-8 w-8 text-slate-700" />
              <p className="mt-2 text-sm">Nenhuma tela cadastrada ainda.</p>
              <p className="text-xs text-slate-500">Cadastre sua primeira TV ou monitor ao lado.</p>
            </div>
          ) : (
            data.screens.map((s: any) => (
              <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {s.device_type === 'organic_windows_monitor' ? (
                      <Laptop className="h-5 w-5 text-violet-400" />
                    ) : (
                      <Tv className="h-5 w-5 text-cyan-400" />
                    )}
                    <div>
                      <strong className="text-sm font-bold text-white">{s.name}</strong>
                      <p className="text-[11px] text-slate-400">
                        {s.device_type === 'organic_windows_monitor' ? 'Monitor Windows' : 'Smart TV'} ·{' '}
                        <span className="text-emerald-400">{s.status === 'paired' ? 'Pareada e Ativa' : 'Pendente de Pareamento'}</span>
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-mono text-slate-400">
                    0,05 pts/exibição
                  </span>
                </div>

                {s.status === 'pending_pairing' && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                    <p className="text-xs text-amber-300">
                      Abra <strong>/organic-tv</strong> no navegador do aparelho e digite o código exibido lá:
                    </p>
                    <div className="flex gap-2">
                      <input
                        maxLength={6}
                        placeholder="Código de 6 dígitos"
                        value={pairing[s.id] || ''}
                        onChange={(e) =>
                          setPairing({ ...pairing, [s.id]: e.target.value.toUpperCase() })
                        }
                        className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm uppercase text-white"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void pair(s.id)}
                        className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300"
                      >
                        Parear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950 p-4 text-xs text-slate-400">
            <strong className="text-slate-300 block mb-1">Regras de Pontuação da Rede Orgânica:</strong>
            <ul className="list-disc space-y-1 pl-4">
              <li>Exibições Validadas entre 06:00 e 23:59 rendem <strong>0,05 Pontos da Rede</strong>.</li>
              <li>A madrugada (00:00 às 05:59) possui pontuação zero por proteção antifraude.</li>
              <li>Os pontos acumulados não expiram com o encerramento de campanhas individuais.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Available Rewards Catalog */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Catálogo de Benefícios & Prêmios</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Escolha um prêmio para fixar como seu objetivo ou resgate com seus Pontos da Rede.
            </p>
          </div>
          <a
            href="/organic-rewards"
            className="text-xs font-bold text-amber-400 hover:text-amber-300"
          >
            Ver todos ({data.rewards.length}) →
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.rewards.slice(0, 6).map((r: any) => {
            const basePts = Math.round(Number(r.credits_required || 80));
            const bonus = Number(r.bonus_percentage || 0);
            const netPts = bonus > 0 ? Math.max(1, Math.round(basePts * (1 - bonus / 100))) : basePts;
            const canAfford = Number(p.available_balance || 0) >= netPts;
            const isPinned = pinned?.id === r.id;

            return (
              <article
                key={r.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-300">
                      {r.companies?.trade_name || 'Estabelecimento'}
                    </span>
                    {bonus > 0 && (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-300 font-mono">
                        +{bonus}% BÔNUS
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-base font-black text-white">{r.title}</h3>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                    {r.description || 'Resgate este benefício com seus Pontos da Rede.'}
                  </p>
                </div>

                <div className="mt-5 border-t border-slate-800/80 pt-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Pontos Necessários</span>
                      <p className="font-mono text-xl font-black text-amber-300">
                        {netPts} <span className="text-xs font-normal">pts</span>
                        {bonus > 0 && (
                          <span className="ml-1.5 text-xs text-slate-500 line-through">{basePts}</span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busy || isPinned}
                      onClick={() => void pinReward(r.id)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                        isPinned
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'border border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Pin className="h-3 w-3" />
                      {isPinned ? 'Fixado' : 'Fixar'}
                    </button>
                  </div>

                  <button
                    disabled={busy || !canAfford}
                    onClick={() => void reserve(r.id)}
                    className="mt-3 w-full rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-30"
                  >
                    {!canAfford ? 'Pontos insuficientes' : 'RESGATAR AGORA'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
