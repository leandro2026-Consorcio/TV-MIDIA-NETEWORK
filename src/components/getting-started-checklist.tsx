'use client';

import Link from 'next/link';
import { Check, Circle, ArrowRight } from 'lucide-react';

interface ChecklistContext {
  trial?: { status?: string } | null;
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
  const items = [
    { label: 'Empresa criada', done: true },
    { label: 'Trial gratuito ativado', done: context.trial?.status === 'active' },
    { label: 'Cadastrar primeira TV', done: !!context.checklist?.screen, href: '/screens/new' },
    { label: 'Parear primeira TV', done: !!context.checklist?.pairedScreen, href: '/screens' },
    { label: 'Enviar primeira mídia', done: !!context.checklist?.media, href: '/media/new' },
    { label: 'Criar primeira programação', done: !!context.checklist?.playlist, href: '/playlists/new' },
    { label: 'Rodar propaganda na TV', done: !!context.checklist?.playback, href: '/help/getting-started' },
    { label: 'Convidar parceiro', done: !!context.checklist?.inviteCopied, href: '/company/invites' },
  ];
  const completed = items.filter((item) => item.done).length;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-bold text-white">Comece em poucos passos</h2>
          <p className="mt-1 text-xs text-slate-400">{completed} de {items.length} etapas concluídas pela empresa.</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800 sm:w-36">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(completed / items.length) * 100}%` }} />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const content = (
            <span className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-xs ${item.done ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300' : 'border-slate-800 bg-slate-950 text-slate-300'}`}>
              {item.done ? <Check className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0 text-slate-600" />}
              <span className="flex-1">{item.label}</span>
              {!item.done && item.href && <ArrowRight className="h-3.5 w-3.5 text-slate-600" />}
            </span>
          );
          return item.href && !item.done ? <Link key={item.label} href={item.href}>{content}</Link> : <div key={item.label}>{content}</div>;
        })}
      </div>
    </section>
  );
}
