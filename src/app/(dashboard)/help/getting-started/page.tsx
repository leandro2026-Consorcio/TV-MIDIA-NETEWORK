import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HelpButton } from '@/components/help-button';
import { OnboardingTour } from '@/components/onboarding-tour';
import { Download, Monitor, ArrowRight } from 'lucide-react';

const labels: Record<string, string> = {
  company: 'Empresa',
  creator: 'Creator',
  leader: 'Líder',
  support: 'Suporte',
  master: 'Master',
  organic: 'Rede Orgânica & Participantes',
};

export default async function GettingStartedHelpPage() {
  const supabase = createClient();
  const [{ data: articles }, { data: flows }, { data: flags }, { data: progress }] = await Promise.all([
    (supabase.from('help_articles') as any).select('*').eq('status', 'published').order('display_order'),
    (supabase.from('onboarding_flows') as any).select('*,onboarding_steps(*)').eq('status', 'active'),
    (supabase.from('platform_settings') as any).select('key,value').in('key', ['expansion_program_v1', 'social_v2']),
    (supabase.rpc as any)('get_my_expansion_onboarding'),
  ]);

  const enabled = new Set((flags || []).filter((f: any) => f.value === true || f.value === 'true').map((f: any) => f.key));
  const visibleFlows = (flows || []).filter((f: any) => !f.feature_flag || enabled.has(f.feature_flag));
  const groups = Object.entries(
    (articles || []).reduce((acc: Record<string, any[]>, article: any) => {
      (acc[article.audience] ??= []).push(article);
      return acc;
    }, {})
  ) as Array<[string, any[]]>;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <OnboardingTour autoOpen={false} />
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-400">MPM Onboarding & Help Center</p>
          <h1 className="mt-2 text-3xl font-extrabold text-white">Aprenda fazendo</h1>
          <p className="mt-2 text-sm text-slate-400">Checklists guiados pelo estado real do sistema e manuais curtos.</p>
        </div>
        <HelpButton />
      </header>

      {progress && (
        <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-cyan-300">Ativação {progress.audience}</p>
              <h2 className="mt-1 text-xl font-bold text-white">{progress.completed} de {progress.total} sinais concluídos</h2>
            </div>
            <span className="text-3xl font-black text-cyan-300">{progress.percent}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-cyan-400" style={{ width: `${progress.percent}%` }} />
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-sky-500/30 bg-slate-900 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-400 border border-sky-500/20">
              <Monitor className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Guia Oficial do Player</span>
              <h2 className="text-xl font-bold text-white">Como instalar uma TV ou Monitor Windows</h2>
            </div>
          </div>
          <a
            href="/downloads/mpm-player/windows"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-600 transition shadow-lg shadow-sky-500/20"
          >
            <Download className="h-4 w-4" /> Baixar Player Windows (.exe)
          </a>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3 text-xs">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 font-bold text-sky-400">1</span>
            <h3 className="font-bold text-white text-sm">Baixe o Instalador</h3>
            <p className="text-slate-400">Baixe o <strong>MPM-Player-Setup.exe</strong> no computador conectado à TV. Compatível com Windows 10 e Windows 11.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 font-bold text-sky-400">2</span>
            <h3 className="font-bold text-white text-sm">Instalação em 1 Clique</h3>
            <p className="text-slate-400">Dê duplo clique e clique em <em>Instalar Agora</em>. Sem necessidade de administrador, PowerShell ou terminal.</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-400">3</span>
            <h3 className="font-bold text-white text-sm">Pareamento Instantâneo</h3>
            <p className="text-slate-400">O player abre em tela cheia com o código de 6 dígitos. Digite o código no menu <strong>Minhas TVs</strong> para parear.</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-white">Checklists disponíveis</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {visibleFlows.map((flow: any) => (
            <div key={flow.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-bold uppercase text-purple-400">{flow.audience}</p>
              <h3 className="mt-1 font-bold text-white">{flow.name}</h3>
              <div className="mt-3 space-y-2">
                {(flow.onboarding_steps || [])
                  .filter((s: any) => !s.required_feature_flag || enabled.has(s.required_feature_flag))
                  .sort((a: any, b: any) => a.display_order - b.display_order)
                  .map((step: any) => (
                    <Link key={step.id} href={step.action_href || '#'} className="block rounded-xl bg-slate-950 p-3 text-sm text-slate-300 hover:text-cyan-300">
                      {step.display_order}. {step.title}
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {groups.map(([audience, list]) => (
        <section key={audience}>
          <h2 className="text-xl font-bold text-white">{labels[audience] || audience}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {list.map((article: any) => (
              <article key={article.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                <h3 className="font-bold text-white">{article.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{article.objective}</p>
                <ol className="mt-4 space-y-2">
                  {(article.steps || []).map((step: string, index: number) => (
                    <li key={index} className="text-xs text-slate-300">
                      <span className="mr-2 font-black text-cyan-400">{index + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-300">Resultado: {article.expected_result}</p>
                {article.action_href && (
                  <Link href={article.action_href} className="mt-4 inline-flex rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white">
                    {article.action_label || 'Fazer agora'}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      {/* Conclusão do Onboarding */}
      <section className="rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">Onboarding Concluído</span>
          <h2 className="text-xl font-bold text-white">Sua estrutura está pronta</h2>
          <p className="text-xs text-slate-300 mt-1">
            Sua TV, programação, rede e convites foram configurados com sucesso.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-600/25 shrink-0"
        >
          IR PARA O PAINEL PRINCIPAL <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
