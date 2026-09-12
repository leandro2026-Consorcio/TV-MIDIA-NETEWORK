import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HelpButton } from '@/components/help-button';
import { OnboardingTour } from '@/components/onboarding-tour';
import { Download, Monitor, ArrowRight, Tv } from 'lucide-react';
import { ConditionalPwaInstall } from '@/components/conditional-pwa-install';

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

      <section className="min-w-0 rounded-3xl border border-sky-500/30 bg-slate-900 p-4 sm:p-6 shadow-xl">
        <div className="border-b border-slate-800 pb-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">Guia Oficial do Player</span>
          <h2 className="mt-1 text-xl font-bold text-white">Como você vai usar sua tela?</h2>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <article className="min-w-0 rounded-2xl border border-sky-500/30 bg-slate-950 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-400 border border-sky-500/20">
              <Tv className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">📺 SMART TV</h3>
              <p className="text-sm font-bold text-emerald-400">Sem instalação</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-300">Use diretamente pelo navegador da Smart TV. <strong className="text-white">Não precisa baixar nenhum programa.</strong></p>
          <ol className="mt-4 space-y-3 text-xs text-slate-400">
            <li><strong className="text-white">1. Abra o navegador da TV:</strong> acesse <span className="break-all font-mono text-sky-300">midiapormidia.com.br/tv</span>.</li>
            <li><strong className="text-white">2. Veja o código:</strong> a TV exibirá o código de pareamento.</li>
            <li><strong className="text-white">3. Use seu celular:</strong> Minhas TVs → Adicionar TV → Parear TV e digite o código.</li>
            <li><strong className="text-white">4. Pronto:</strong> a TV fica vinculada à conta e inicia o Player MPM.</li>
          </ol>
          <Link href="/tv" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-600 sm:w-auto">
            <Tv className="h-4 w-4" /> CONECTAR SMART TV
          </Link>
          <ConditionalPwaInstall />
          </article>

          <article className="min-w-0 rounded-2xl border border-purple-500/30 bg-slate-950 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-3 text-purple-400"><Monitor className="h-6 w-6" /></div>
              <div><h3 className="text-lg font-bold text-white">🖥 WINDOWS / MONITOR PROFISSIONAL</h3><p className="text-xs text-slate-400">Para computador, mini PC ou TV conectada a um equipamento Windows.</p></div>
            </div>
            <ol className="mt-4 space-y-3 text-xs text-slate-400">
              <li><strong className="text-white">1. Baixe o Player:</strong> MPM-Player-Setup.exe.</li>
              <li><strong className="text-white">2. Instale:</strong> compatível com Windows 10 e Windows 11.</li>
              <li><strong className="text-white">3. Código de pareamento:</strong> o Player abre e mostra o código.</li>
              <li><strong className="text-white">4. Pareie:</strong> Minhas TVs → Adicionar TV → digitar código.</li>
            </ol>
            <a href="/downloads/mpm-player/windows" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-500 sm:w-auto">
              <Download className="h-4 w-4" /> BAIXAR PLAYER WINDOWS (.EXE)
            </a>
          </article>
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
