'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Circle,
  ArrowRight,
  HelpCircle,
  Tv,
  Radio,
  Image as ImageIcon,
  ListVideo,
  Play,
  Gift,
  CircleHelp,
  Newspaper,
  BarChart3,
  Megaphone,
  Settings2,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { CopyTvLinkButton, TV_PLAYER_URL } from '@/components/copy-tv-link-button';

interface ChecklistContext {
  trial?: { status?: string } | null;
  progress?: {
    first_screen_created_at?: string | null;
    first_screen_paired_at?: string | null;
    first_media_uploaded_at?: string | null;
    first_playlist_created_at?: string | null;
    first_playback_detected_at?: string | null;
    first_invite_copied_at?: string | null;
  } | null;
  checklist?: {
    screen?: boolean;
    pairedScreen?: boolean;
    media?: boolean;
    playlist?: boolean;
    playback?: boolean;
    inviteCopied?: boolean;
  };
}

export function GettingStartedChecklist({ context }: { context: ChecklistContext }) {
  const chk = context.checklist || {};
  const prog = context.progress || {};

  const step1Done = !!chk.screen || !!prog.first_screen_created_at;
  const step2Done = !!chk.pairedScreen || !!prog.first_screen_paired_at;
  const step3Done = !!chk.media || !!prog.first_media_uploaded_at;
  const step4Done = !!chk.playlist || !!prog.first_playlist_created_at;
  const step5Done = !!chk.playback || !!prog.first_playback_detected_at;
  const step6Done = !!chk.inviteCopied || !!prog.first_invite_copied_at;

  const stepsDef = [
    {
      num: 1,
      title: 'Cadastrar TV',
      done: step1Done,
      text: 'Cadastre a primeira TV onde suas propagandas serão exibidas.',
      actionLabel: 'Cadastrar TV',
      actionHref: '/screens/new',
      icon: Tv,
      tourStep: 1,
    },
    {
      num: 2,
      title: 'Parear TV',
      done: step2Done,
      text: `Abra ${TV_PLAYER_URL} na sua televisão e digite o código no painel.`,
      actionLabel: 'Parear minha TV',
      actionHref: '/screens',
      showTvCopy: true,
      icon: Radio,
      tourStep: 3,
    },
    {
      num: 3,
      title: 'Enviar mídia',
      done: step3Done,
      text: 'Envie uma imagem ou vídeo da sua propaganda.',
      actionLabel: 'Enviar mídia',
      actionHref: '/media/new',
      icon: ImageIcon,
      tourStep: 4,
    },
    {
      num: 4,
      title: 'Criar programação',
      done: step4Done,
      text: 'Crie uma programação com sua mídia e vincule à TV.',
      actionLabel: 'Criar programação',
      actionHref: '/playlists/new',
      icon: ListVideo,
      tourStep: 5,
    },
    {
      num: 5,
      title: 'Rodar propaganda',
      done: step5Done,
      text: 'Abra a TV e confirme sua propaganda rodando.',
      actionLabel: 'Ver minhas TVs',
      actionHref: '/screens',
      icon: Play,
      tourStep: 6,
    },
    {
      num: 6,
      title: 'Copiar convite VIP',
      done: step6Done,
      text: 'Convide empresas parceiras para fortalecer a rede de mídia da sua cidade.',
      actionLabel: 'Ver convites VIP',
      actionHref: '/company/invites',
      icon: Gift,
      tourStep: 7,
    },
    {
      num: 7,
      title: 'Conhecer relatórios e ajuda',
      done: step1Done && step2Done && step3Done && step4Done && step5Done && step6Done,
      text: 'Conheça relatórios de exibição, conteúdo de respiro, campanhas e a central de ajuda.',
      actionLabel: 'Explorar central de ajuda',
      actionHref: '/help/getting-started',
      icon: CircleHelp,
      tourStep: 0,
      isExploration: true,
    },
  ];

  const mainSteps = stepsDef.filter((s) => !s.isExploration);
  const completedCount = mainSteps.filter((s) => s.done).length;
  const totalCount = mainSteps.length;
  const isAllOperationalDone = completedCount === totalCount;

  // Determine current active step (first non-done main step)
  const activeIndex = stepsDef.findIndex((s) => !s.done);

  function openTour(stepIndex: number) {
    window.dispatchEvent(
      new CustomEvent('open-onboarding-tour', {
        detail: { step: stepIndex },
      })
    );
  }

  return (
    <div className="space-y-8">
      {/* Level 1: Operational Checklist */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-xl">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">Configure sua primeira TV</h2>
              {isAllOperationalDone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Concluído
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {completedCount} de {totalCount} etapas principais concluídas pela sua empresa.
            </p>
          </div>
          <div className="w-full sm:w-48">
            <div className="mb-1.5 flex justify-between text-[11px] font-bold text-slate-400">
              <span>Progresso</span>
              <span>{Math.round((completedCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-4">
          {stepsDef.map((step, idx) => {
            const isDone = step.done;
            const isActive = !isDone && (idx === activeIndex || (step.isExploration && isAllOperationalDone));
            const Icon = step.icon;

            let statusBadge = (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                Pendente
              </span>
            );

            if (isDone) {
              statusBadge = (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                  <Check className="h-3 w-3" /> Concluída
                </span>
              );
            } else if (isActive) {
              statusBadge = (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-1 text-[11px] font-extrabold text-sky-300 border border-sky-500/30 animate-pulse">
                  ➡️ Em andamento
                </span>
              );
            }

            return (
              <div
                key={step.num}
                className={`rounded-2xl border p-5 transition-all ${
                  isActive
                    ? 'border-sky-500/40 bg-sky-950/20 shadow-lg shadow-sky-500/5 ring-1 ring-sky-500/30'
                    : isDone
                    ? 'border-emerald-500/20 bg-slate-900/50'
                    : 'border-slate-800/80 bg-slate-950/40 opacity-75'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-extrabold ${
                        isDone
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isActive
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Etapa {step.num}
                        </span>
                        {statusBadge}
                      </div>
                      <h3 className="text-base font-bold text-white">{step.title}</h3>
                      <p className="text-xs leading-relaxed text-slate-300 max-w-xl">{step.text}</p>

                      {step.showTvCopy && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-950 p-2.5 border border-slate-800 text-xs">
                          <code className="text-slate-300">{TV_PLAYER_URL}</code>
                          <CopyTvLinkButton />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 shrink-0 sm:self-center">
                    <button
                      type="button"
                      onClick={() => openTour(step.tourStep)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-sky-400" /> Como fazer?
                    </button>

                    <Link
                      href={step.actionHref}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                        isActive
                          ? 'bg-sky-500 text-white hover:bg-sky-600 shadow-md shadow-sky-500/20'
                          : isDone
                          ? 'border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
                          : 'border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {step.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Exploration Section: Conheça outras funções */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">Conheça outras funções do sistema</h2>
          <p className="mt-1 text-xs text-slate-400">
            Além da configuração básica da TV, explore os recursos avançados da plataforma.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ExplorationCard
            title="Conteúdo Informativo"
            description="Personalize notícias, previsão do tempo e curiosidades exibidas entre as propagandas das suas TVs."
            icon={Newspaper}
            href="/company/content-sources"
          />

          <ExplorationCard
            title="Relatórios de Exibição"
            description="Auditagem em tempo real Proof of Play com registros de data e horário das mídias exibidas."
            icon={BarChart3}
            href="/playback-logs"
          />

          <ExplorationCard
            title="Minhas Campanhas"
            description="Crie campanhas para divulgar produtos e promoções nas TVs da sua empresa."
            icon={Megaphone}
            href="/campaigns"
          />

          <ExplorationCard
            title="Central de Ajuda"
            description="Acesse o manual completo, tire dúvidas frequentes e aprenda a usar todos os recursos."
            icon={CircleHelp}
            href="/help/getting-started"
          />

          <ExplorationCard
            title="Convites VIP"
            description="Compartilhe convites com empresas parceiras e ganhe mensalidades quando elas se tornarem clientes."
            icon={Gift}
            href="/company/invites"
          />

          <ExplorationCard
            title="Preferências da Empresa"
            description="Gerencie dados cadastrais, marca e preferências das suas telas na rede."
            icon={Settings2}
            href="/network-settings"
          />
        </div>
      </section>
    </div>
  );
}

function ExplorationCard({
  title,
  description,
  icon: Icon,
  href,
}: {
  title: string;
  description: string;
  icon: any;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-5 transition hover:border-sky-500/30 hover:bg-slate-900"
    >
      <div>
        <div className="mb-3 inline-flex rounded-xl bg-sky-500/10 p-2.5 text-sky-400 group-hover:bg-sky-500/20">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold text-white group-hover:text-sky-300">{title}</h3>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{description}</p>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-sky-400 group-hover:translate-x-1 transition-transform">
        <span>Acessar</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}
