'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { getOnboardingContextAction } from '@/app/actions/onboarding';

export function OnboardingProgressBar() {
  const pathname = usePathname();
  const [context, setContext] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (pathname === '/login' || pathname === '/register' || pathname === '/tv') return;

    getOnboardingContextAction()
      .then((ctx) => {
        setContext(ctx);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, [pathname]);

  if (!loaded || !context || !context.hasCompany || dismissed) return null;
  if (pathname === '/onboarding') return null;
  if (context.progress?.dont_show_again) return null;

  const chk = context.checklist || {};
  const prog = context.progress || {};

  const steps = [
    { num: 1, label: 'Cadastrar TV', href: '/screens/new', done: !!chk.screen || !!prog.first_screen_created_at },
    { num: 2, label: 'Parear TV', href: '/screens', done: !!chk.pairedScreen || !!prog.first_screen_paired_at },
    { num: 3, label: 'Enviar mídia', href: '/media/new', done: !!chk.media || !!prog.first_media_uploaded_at },
    { num: 4, label: 'Criar programação', href: '/playlists/new', done: !!chk.playlist || !!prog.first_playlist_created_at },
    { num: 5, label: 'Rodar propaganda', href: '/screens', done: !!chk.playback || !!prog.first_playback_detected_at },
    { num: 6, label: 'Convite VIP', href: '/company/invites', done: !!chk.inviteCopied || !!prog.first_invite_copied_at },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const isAllDone = completedCount === totalCount;

  if (isAllDone) return null;

  const currentStep = steps.find((s) => !s.done) || steps[0];
  const percent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="mb-6 rounded-2xl border border-sky-500/30 bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 p-4 shadow-lg shadow-sky-950/20 transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                Configuração da sua TV
              </span>
              <span className="text-[11px] text-slate-400">
                • {completedCount} de {totalCount} concluídas ({percent}%)
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-white truncate mt-0.5">
              Próxima: <span className="text-sky-300">Etapa {currentStep.num} — {currentStep.label}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <div className="hidden md:block w-28 bg-slate-800 rounded-full h-2 overflow-hidden mr-2">
            <div
              className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          <Link
            href={currentStep.href}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-sm"
          >
            Fazer agora <ArrowRight className="h-3 w-3" />
          </Link>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition"
          >
            Ver etapas
          </Link>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Ocultar barra"
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
