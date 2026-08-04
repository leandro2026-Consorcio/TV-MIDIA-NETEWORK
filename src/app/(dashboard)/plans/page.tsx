import Link from 'next/link';
import { CheckCircle2, MessageCircle } from 'lucide-react';

export default function PlansPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-7">
      <header><p className="text-sky-400 text-xs font-bold uppercase tracking-wider">Planos & assinatura</p><h1 className="text-3xl font-extrabold text-white mt-2">Continue conectado à rede</h1><p className="text-slate-400 text-sm mt-2">Nesta fase não há cobrança automática. Solicite atendimento para conhecer e ativar um plano.</p></header>
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-7">
        <h2 className="text-xl font-bold text-white">Operação Mídia por Mídia</h2>
        <div className="space-y-3 mt-5 text-sm text-slate-300">
          {['Gestão de TVs e telas', 'Biblioteca de mídias próprias', 'Playlists e campanhas internas', 'Suporte para ativação'].map((item) => <p key={item} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{item}</p>)}
        </div>
        <Link href="/onboarding" className="mt-7 inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white font-bold px-5 py-3 rounded-xl text-sm"><MessageCircle className="w-4 h-4" /> Solicitar atendimento</Link>
      </section>
    </div>
  );
}
