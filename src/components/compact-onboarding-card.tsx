'use client';

import Link from 'next/link';
import { CheckCircle2, ArrowRight, Sparkles, HelpCircle } from 'lucide-react';

interface CompactCardProps {
  context: {
    checklist?: {
      screen?: boolean;
      pairedScreen?: boolean;
      media?: boolean;
      playlist?: boolean;
      playback?: boolean;
      inviteCopied?: boolean;
    };
    progress?: {
      first_screen_created_at?: string | null;
      first_screen_paired_at?: string | null;
      first_media_uploaded_at?: string | null;
      first_playlist_created_at?: string | null;
      first_playback_detected_at?: string | null;
      first_invite_copied_at?: string | null;
    } | null;
  };
}

export function CompactOnboardingCard({ context }: CompactCardProps) {
  const chk = context.checklist || {};
  const prog = context.progress || {};

  const steps = [
    { num: 1, label: 'Cadastrar TV', done: !!chk.screen || !!prog.first_screen_created_at, tourStep: 1 },
    { num: 2, label: 'Parear TV', done: !!chk.pairedScreen || !!prog.first_screen_paired_at, tourStep: 3 },
    { num: 3, label: 'Enviar mídia', done: !!chk.media || !!prog.first_media_uploaded_at, tourStep: 4 },
    { num: 4, label: 'Criar programação', done: !!chk.playlist || !!prog.first_playlist_created_at, tourStep: 5 },
    { num: 5, label: 'Rodar propaganda', done: !!chk.playback || !!prog.first_playback_detected_at, tourStep: 6 },
    { num: 6, label: 'Copiar convite VIP', done: !!chk.inviteCopied || !!prog.first_invite_copied_at, tourStep: 7 },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const currentStep = steps.find((s) => !s.done) || null;
  const isAllDone = completedCount === totalCount;

  function openTour(stepIndex = 0) {
    window.dispatchEvent(
      new CustomEvent('open-onboarding-tour', {
        detail: { step: stepIndex },
      })
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-r from-slate-900 via-sky-950/30 to-slate-900 p-6 shadow-xl">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-400">
              <Sparkles className="h-3.5 w-3.5" /> Primeiros passos
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {completedCount} de {totalCount} etapas concluídas
            </span>
          </div>

          {isAllDone ? (
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Configuração inicial concluída!
              </h2>
              <p className="text-xs text-slate-300">
                Sua TV está operacional e suas mídias estão prontas. Você pode explorar outras funções no menu.
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                Próxima etapa: <span className="text-sky-300">Etapa {currentStep?.num} — {currentStep?.label}</span>
              </h2>
              <p className="text-xs text-slate-300">
                Siga as orientações para colocar sua primeira propaganda no ar na Smart TV.
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="pt-1">
            <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => openTour(currentStep ? currentStep.tourStep : 0)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white"
          >
            <HelpCircle className="h-4 w-4 text-sky-400" /> Ver guia
          </button>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-600"
          >
            Continuar configuração <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
