import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminMpmPage() {
  const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login');
  const { data: profile } = await (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).maybeSingle(); if (!profile?.is_master_admin) notFound();
  const [{ data: metrics }, { data: flags }, { data: jobs }] = await Promise.all([
    (supabase.rpc as any)('get_mpm_admin_dashboard'),
    (supabase.from('platform_settings') as any).select('key,value').in('key', ['inventory_v2','wallet_mpm_v2','settlement_v2','matching_v2','partner_programs_v2','social_v2','creator_v2','events_v2','payout_v2','dynamic_pricing_v2']),
    (supabase.from('mpm_job_runs') as any).select('job_name,run_key,status,counters,started_at').order('started_at', { ascending: false }).limit(10),
  ]);
  return <div className="mx-auto max-w-7xl space-y-7"><header><p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Master Admin</p><h1 className="mt-2 text-3xl font-black text-white">Operação MPM</h1></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(metrics || {}).map(([k,v]) => <div key={k} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-500">{k.replaceAll('_',' ')}</p><p className="mt-3 text-2xl font-black text-white">{Number(v || 0).toLocaleString('pt-BR')}</p></div>)}</section>
    <section className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">Feature flags</h2><div className="mt-4 space-y-2">{(flags || []).map((f:any) => <div key={f.key} className="flex justify-between rounded-xl bg-slate-950 p-3 text-sm"><span className="text-slate-300">{f.key}</span><span className={f.value === true ? 'font-bold text-emerald-400' : 'font-bold text-amber-400'}>{String(f.value)}</span></div>)}</div></div>
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">Jobs idempotentes</h2><div className="mt-4 space-y-2">{(jobs || []).map((j:any) => <div key={`${j.job_name}:${j.run_key}`} className="rounded-xl bg-slate-950 p-3"><p className="text-sm font-semibold text-slate-200">{j.job_name} · {j.status}</p><p className="mt-1 text-xs text-slate-500">{j.run_key}</p></div>)}</div></div></section>
  </div>;
}
