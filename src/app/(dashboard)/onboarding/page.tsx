'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Image as ImageIcon, ListVideo, Loader2, Tv } from 'lucide-react';
import { getOnboardingContextAction } from '@/app/actions/onboarding';
import { TrialStatusCard } from '@/components/trial-status-card';

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

  const steps = [
    { done: context.checklist.screen, title: 'Cadastrar minha primeira TV', text: 'Crie a tela e use o código exibido no player para parear.', href: '/screens/new', action: 'Adicionar TV', icon: Tv },
    { done: context.checklist.media, title: 'Enviar minha primeira mídia', text: 'Envie uma imagem ou vídeo próprio para sua programação interna.', href: '/media/new', action: 'Enviar mídia', icon: ImageIcon },
    { done: context.checklist.playlist, title: 'Rodar minha primeira programação', text: 'Monte uma playlist e atribua à TV cadastrada.', href: '/playlists/new', action: 'Criar programação', icon: ListVideo },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <TrialStatusCard trial={context.trial} />
      <div>
        <p className="text-sky-400 text-xs font-bold uppercase tracking-wider">Boas-vindas, {context.companyName}</p>
        <h1 className="text-3xl font-extrabold text-white mt-2">Comece em 3 passos</h1>
        <p className="text-slate-400 text-sm mt-2">Prepare sua primeira programação para começar a exibir na TV.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-mono text-slate-500">PASSO {index + 1}</span>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-sky-400'}`}>
                  {step.done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </span>
              </div>
              <h2 className="font-bold text-white">{step.title}</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed flex-1">{step.text}</p>
              <Link href={step.href} className="mt-6 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-300 text-xs font-bold text-center py-2.5 rounded-xl">
                {step.done ? 'Revisar' : step.action}
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
