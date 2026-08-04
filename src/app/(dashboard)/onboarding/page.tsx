'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getOnboardingContextAction } from '@/app/actions/onboarding';
import { TrialStatusCard } from '@/components/trial-status-card';
import { GettingStartedChecklist } from '@/components/getting-started-checklist';
import { HelpButton } from '@/components/help-button';
import { OnboardingTour } from '@/components/onboarding-tour';

export default function OnboardingPage() {
  const [context, setContext] = useState<any>(null);
  useEffect(() => { getOnboardingContextAction().then(setContext); }, []);
  if (!context) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-sky-400" /></div>;
  if (!context.hasCompany) return (
    <div className="max-w-xl mx-auto text-center bg-slate-900 border border-slate-800 rounded-2xl p-10">
      <h1 className="text-xl font-bold text-white">Complete seu cadastro empresarial</h1>
      <p className="text-sm text-slate-400 mt-2 mb-6">Cadastre uma empresa para liberar seu período gratuito.</p>
      <Link href="/empresa/cadastro" className="bg-sky-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold">Cadastrar empresa</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <OnboardingTour autoOpen={
        context.trial?.status === 'active' &&
        !context.progress?.tour_completed_at &&
        !context.progress?.dont_show_again &&
        !context.progress?.tour_seen_at
      } />
      <TrialStatusCard trial={context.trial} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
        <p className="text-sky-400 text-xs font-bold uppercase tracking-wider">Boas-vindas, {context.companyName}</p>
        <h1 className="text-3xl font-extrabold text-white mt-2">Primeiros passos</h1>
        <p className="text-slate-400 text-sm mt-2">Prepare sua primeira programação para começar a exibir na TV.</p>
        </div>
        <HelpButton />
      </div>
      <GettingStartedChecklist context={context} />
    </div>
  );
}
