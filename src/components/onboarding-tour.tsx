'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ChevronLeft, ChevronRight, Tv, Link2, Radio, Image, ListVideo, Maximize, Gift, Sparkles } from 'lucide-react';
import { markOnboardingEventAction } from '@/app/actions/onboarding';
import { CopyTvLinkButton, TV_PLAYER_URL } from '@/components/copy-tv-link-button';

export const onboardingTourSteps = [
  { title: 'Bem-vindo ao Mídia por Mídia', text: 'Você está no período gratuito de 60 dias. Vamos configurar sua primeira TV e rodar sua propaganda.', icon: Sparkles },
  { title: 'Cadastre sua primeira TV', text: 'Primeiro, cadastre a TV ou tela onde suas propagandas serão exibidas.', icon: Tv, href: '/screens/new', action: 'Cadastrar TV' },
  { title: 'Abra o player na televisão', text: 'Na sua Smart TV, TV Box ou computador conectado à TV, acesse o link do player.', icon: Link2, copyTvLink: true },
  { title: 'Faça o pareamento', text: 'A TV exibirá um código. Digite esse código no painel para vinculá-la à sua empresa.', icon: Radio, href: '/screens', action: 'Parear TV' },
  { title: 'Envie sua primeira mídia', text: 'Envie uma imagem ou vídeo da sua propaganda. No trial, mídia própria pode ser aprovada automaticamente quando essa opção estiver habilitada.', icon: Image, href: '/media/new', action: 'Enviar mídia' },
  { title: 'Crie sua programação', text: 'Depois de enviar a mídia, crie uma playlist e vincule-a à TV cadastrada.', icon: ListVideo, href: '/playlists/new', action: 'Criar programação' },
  { title: 'Inicie a apresentação na TV', text: 'Na TV, clique em “Iniciar apresentação” para tentar abrir em tela cheia. O player continua funcionando mesmo se o navegador mantiver alguma barra visível.', icon: Maximize },
  { title: 'Convide parceiros estratégicos', text: 'Você recebeu 3 convites VIP para chamar empresas parceiras. Elas também ganham 60 dias gratuitos.', icon: Gift, href: '/company/invites', action: 'Ver meus convites' },
];

interface TourProps {
  autoOpen?: boolean;
  initialStep?: number;
}

export function OnboardingTour({ autoOpen = false, initialStep = 0 }: TourProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(initialStep);
  const [dontShow, setDontShow] = useState(false);

  const show = useCallback((automatic = false, targetStep?: number) => {
    const idx = typeof targetStep === 'number' && targetStep >= 0 && targetStep < onboardingTourSteps.length
      ? targetStep
      : initialStep;
    setStep(idx);
    setOpen(true);
    void markOnboardingEventAction('tour_seen');
    if (!automatic) void markOnboardingEventAction('tour_started');
  }, [initialStep]);

  useEffect(() => {
    if (autoOpen) show(true, initialStep);
  }, [autoOpen, initialStep, show]);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<{ step?: number }>;
      const requestedStep = customEvent.detail?.step;
      show(false, requestedStep);
    };
    window.addEventListener('open-onboarding-tour', listener);
    return () => window.removeEventListener('open-onboarding-tour', listener);
  }, [show]);

  async function close(kind: 'close' | 'skip' | 'complete') {
    if (kind === 'skip') await markOnboardingEventAction('tour_skipped');
    if (kind === 'complete') await markOnboardingEventAction('tour_completed');
    if (dontShow) await markOnboardingEventAction('dont_show_again');
    setOpen(false);
  }

  function next() {
    if (step === 0) void markOnboardingEventAction('tour_started');
    if (step === onboardingTourSteps.length - 1) void close('complete');
    else setStep((value) => value + 1);
  }

  if (!open) return null;
  const current = onboardingTourSteps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-sky-500/20 bg-slate-900 shadow-2xl">
        <div className="h-1 bg-slate-800"><div className="h-full bg-sky-500 transition-all" style={{ width: `${((step + 1) / onboardingTourSteps.length) * 100}%` }} /></div>
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="rounded-2xl bg-sky-500/10 p-3 text-sky-300"><Icon className="h-6 w-6" /></span>
            <button type="button" onClick={() => void close('close')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white" aria-label="Fechar tour"><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-sky-400">Etapa {step + 1} de {onboardingTourSteps.length}</p>
          <h2 id="tour-title" className="mt-2 text-2xl font-extrabold text-white">{current.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{current.text}</p>
          {current.copyTvLink && <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4"><code className="mb-3 block break-all text-xs text-slate-300">{TV_PLAYER_URL}</code><CopyTvLinkButton /></div>}
          {current.href && (
            <Link
              href={current.href}
              onClick={() => void close('close')}
              className="mt-5 inline-flex rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-2.5 text-xs font-bold text-purple-300 hover:bg-purple-500/20"
            >
              {current.action}
            </Link>
          )}
          <label className="mt-7 flex cursor-pointer items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={dontShow} onChange={(event) => setDontShow(event.target.checked)} className="rounded border-slate-700 bg-slate-950" /> Não mostrar novamente automaticamente</label>
          <div className="mt-6 flex flex-col-reverse justify-between gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center">
            <button type="button" onClick={() => void close('skip')} className="text-xs font-bold text-slate-500 hover:text-slate-300">Pular por enquanto</button>
            <div className="flex gap-2">
              {step > 0 && <button type="button" onClick={() => setStep((value) => value - 1)} className="inline-flex items-center gap-1 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-300"><ChevronLeft className="h-4 w-4" /> Voltar</button>}
              <button type="button" onClick={next} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-600 sm:flex-none">{step === 0 ? 'Começar agora' : step === onboardingTourSteps.length - 1 ? 'Concluir' : 'Próximo'}{step < onboardingTourSteps.length - 1 && <ChevronRight className="h-4 w-4" />}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
