'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Gift, Loader2 } from 'lucide-react';
import { getOnboardingContextAction } from '@/app/actions/onboarding';

export default function CompanyInvitesPage() {
  const [context, setContext] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { getOnboardingContextAction().then(setContext); }, []);

  async function copy(code: string) {
    const url = `${window.location.origin}/invite/${encodeURIComponent(code)}`;
    await navigator.clipboard.writeText(url);
    setCopied(code);
    window.setTimeout(() => setCopied(null), 1800);
  }

  if (!context) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>;
  const invites = context.invites || [];
  return (
    <div className="max-w-4xl mx-auto space-y-7">
      <header className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3"><span className="bg-purple-500/10 text-purple-400 p-3 rounded-xl"><Gift className="w-6 h-6" /></span><div><h1 className="text-2xl font-extrabold text-white">Convites VIP</h1><p className="text-slate-400 text-sm">Você possui {invites.length} convites estratégicos.</p></div></div>
      </header>
      <div className="bg-purple-500/10 border border-purple-500/20 text-purple-200 rounded-2xl p-5 text-sm leading-relaxed">
        Convide empresas parceiras para entrar na rede com 60 dias gratuitos. Quanto mais empresas estratégicas participarem, maior será a força da mídia compartilhada para o seu negócio.
      </div>
      <div className="space-y-4">
        {invites.map((invite: any, index: number) => (
          <article key={invite.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><span className="text-white font-bold">Convite {index + 1}</span><Status status={invite.status} /></div>
              <code className="text-purple-300 text-xs block mt-2">{invite.invite_code}</code>
              {invite.invited_company_name && <p className="text-xs text-slate-400 mt-2">Aceito por: {invite.invited_company_name}</p>}
              {invite.accepted_at && <p className="text-[11px] text-slate-500">Em {new Date(invite.accepted_at).toLocaleString('pt-BR')}</p>}
            </div>
            <button onClick={() => copy(invite.invite_code)} disabled={invite.status === 'accepted' || invite.status === 'expired'} className="bg-slate-950 hover:bg-slate-800 disabled:opacity-40 border border-slate-800 text-sky-300 px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2">
              {copied === invite.invite_code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied === invite.invite_code ? 'Link copiado' : 'Copiar link'}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = { available: 'Disponível', created: 'Disponível', sent: 'Enviado', accepted: 'Aceito', expired: 'Expirado', cancelled: 'Cancelado' };
  const style = status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' : status === 'expired' ? 'bg-rose-500/10 text-rose-400' : 'bg-sky-500/10 text-sky-400';
  return <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${style}`}>{labels[status] || status}</span>;
}
