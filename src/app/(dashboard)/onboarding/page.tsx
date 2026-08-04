'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, HelpCircle, EyeOff, Check } from 'lucide-react';
import { getOnboardingContextAction, markOnboardingEventAction } from '@/app/actions/onboarding';
import { TrialStatusCard } from '@/components/trial-status-card';
import { GettingStartedChecklist } from '@/components/getting-started-checklist';
import { OnboardingTour } from '@/components/onboarding-tour';

export default function OnboardingPage() {
  const [context, setContext] = useState<any>(null);
  const [dontShowSaved, setDontShowSaved] = useState(false);
  const [savingDontShow, setSavingDontShow] = useState(false);

  useEffect(() => {
    getOnboardingContextAction().then((ctx) => {
      setContext(ctx);
      if (ctx?.progress?.dont_show_again) {
        setDontShowSaved(true);
      }
    });
  }, []);

  async function handleToggleDontShow() {
    setSavingDontShow(true);
    try {
      const res = await markOnboardingEventAction('dont_show_again');
      if (res.success) {
        setDontShowSaved(true);
        setContext((current: any) => ({
          ...current,
          progress: { ...current?.progress, dont_show_again: true },
        }));
      }
    } finally {
      setSavingDontShow(false);
    }
  }

  function openTour(stepIndex = 0) {
    window.dispatchEvent(
      new CustomEvent('open-onboarding-tour', {
        detail: { step: stepIndex },
      })
    );
  }

  if (!context) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!context.hasCompany) {
    return (
      <div className="max-w-xl mx-auto text-center bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-xl space-y-4">
        <h1 className="text-2xl font-bold text-white">Complete seu cadastro empresarial</h1>
        <p className="text-sm text-slate-400">Cadastre uma empresa para liberar seu período gratuito e telas.</p>
        <Link href="/empresa/cadastro" className="inline-block bg-sky-500 hover:bg-sky-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-sky-500/20">
          Cadastrar empresa
        </Link>
      </div>
    );
  }

  const shouldAutoOpen =
    context.trial?.status === 'active' &&
    !context.progress?.tour_seen_at &&
    !context.progress?.dont_show_again &&
    !context.progress?.tour_completed_at;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <OnboardingTour autoOpen={shouldAutoOpen} />

      {context.trial && <TrialStatusCard trial={context.trial} />}

      {/* Header Banner */}
      <div className="flex flex-col justify-between gap-6 border-b border-slate-800 pb-6 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-400">
            <Sparkles className="h-3.5 w-3.5" /> Guia de Início — {context.companyName}
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Vamos colocar sua primeira propaganda no ar
          </h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Siga as etapas abaixo. Você pode sair e voltar quando quiser. O seu progresso é salvo automaticamente.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openTour(0)}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500/10 border border-sky-500/30 px-4 py-2.5 text-xs font-bold text-sky-300 hover:bg-sky-500/20 transition shadow-sm"
          >
            <HelpCircle className="h-4 w-4" /> Abrir tour guiado
          </button>

          <button
            type="button"
            onClick={handleToggleDontShow}
            disabled={dontShowSaved || savingDontShow}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
              dontShowSaved
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 opacity-80 cursor-default'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {savingDontShow ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : dontShowSaved ? (
              <Check className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            {dontShowSaved ? 'Ocultação automática salva' : 'Não mostrar automaticamente'}
          </button>
        </div>
      </div>

      <GettingStartedChecklist context={context} />
    </div>
  );
}
