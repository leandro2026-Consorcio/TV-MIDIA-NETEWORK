'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Sparkles } from 'lucide-react';

export function TrialStatusCard({ trial }: { trial: any }) {
  if (!trial) return null;
  const expired = trial.status === 'expired';
  const warning = trial.status === 'active' && trial.daysRemaining <= 7;
  const tone = expired ? 'rose' : warning ? 'amber' : 'emerald';
  const colors: Record<string, string> = {
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  };

  return (
    <section className={`border rounded-2xl p-6 ${colors[tone]}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="bg-slate-950/40 p-3 rounded-xl">
            {expired ? <AlertTriangle className="w-6 h-6" /> : warning ? <Clock className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">
              {expired ? 'Seu período gratuito terminou' : 'Você está no período gratuito'}
            </h2>
            <p className="text-sm mt-1">
              {expired
                ? 'Seu painel continua disponível. Ative um plano para manter todos os recursos operacionais.'
                : `Faltam ${trial.daysRemaining} dias para terminar seu teste gratuito.`}
            </p>
            <div className="flex flex-wrap gap-4 text-xs mt-3 opacity-80">
              <span className="inline-flex gap-1.5"><CalendarDays className="w-4 h-4" /> Início: {formatDate(trial.trial_start_date)}</span>
              <span className="inline-flex gap-1.5"><CalendarDays className="w-4 h-4" /> Término: {formatDate(trial.trial_end_date)}</span>
              <span className="inline-flex gap-1.5"><CheckCircle2 className="w-4 h-4" /> Status: {expired ? 'Expirado' : 'Ativo'}</span>
            </div>
          </div>
        </div>
        <Link href="/plans" className="shrink-0 bg-white/10 hover:bg-white/15 border border-white/10 text-white px-4 py-2.5 rounded-xl text-xs font-bold text-center">
          Ver planos / atendimento
        </Link>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  if (!value) return '—';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
}
