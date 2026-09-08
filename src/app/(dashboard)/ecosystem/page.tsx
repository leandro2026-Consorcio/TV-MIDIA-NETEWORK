import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BarChart3, CalendarDays, Handshake, Megaphone, Radio, Wallet } from 'lucide-react';

const number = (value: unknown) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default async function EcosystemPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: links } = await (supabase.from('company_users') as any).select('company_id,companies(trade_name)').eq('user_id', user.id).eq('is_active', true).limit(1);
  const companyId = links?.[0]?.company_id;
  if (!companyId) return <Empty title="Ecossistema MPM" text="Vincule uma empresa para acessar inventário, matching e programas." />;
  const [{ data: metrics }, { data: runs }, { data: programs }, { data: events }, { data: channels }] = await Promise.all([
    (supabase.from('mpm_company_dashboard') as any).select('*').eq('company_id', companyId).maybeSingle(),
    (supabase.from('matching_runs') as any).select('id,status,requested_insertions,allocated_insertions,started_at').eq('buyer_company_id', companyId).order('started_at', { ascending: false }).limit(5),
    (supabase.from('partner_programs') as any).select('id,name,program_type,reward_type,status').order('created_at', { ascending: false }).limit(5),
    (supabase.from('events') as any).select('id,name,starts_at,ends_at,status').order('starts_at', { ascending: false }).limit(5),
    (supabase.from('social_channels') as any).select('id,display_name,provider,status,participation_enabled').eq('owner_type', 'company').eq('owner_id', companyId).limit(5),
  ]);
  const fillRate = Number(metrics?.total_capacity) > 0 ? (Number(metrics?.occupied_capacity) / Number(metrics?.total_capacity)) * 100 : 0;
  return <div className="mx-auto max-w-7xl space-y-7">
    <header><p className="text-xs font-bold uppercase tracking-[.25em] text-purple-400">Mídia por Mídia</p><h1 className="mt-2 text-3xl font-black text-white">Ecossistema operacional</h1><p className="mt-1 text-sm text-slate-400">Inventário, distribuição, créditos, programas, social e eventos no mesmo core.</p></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Radio />} label="Inventários ativos" value={number(metrics?.inventory_items)} />
      <Metric icon={<BarChart3 />} label="Capacidade" value={number(metrics?.total_capacity)} helper={`${number(fillRate)}% ocupada`} />
      <Metric icon={<Wallet />} label="Saldo disponível" value={`${number(metrics?.available_credits)} CR`} />
      <Metric icon={<Megaphone />} label="Proof of Delivery" value={number(metrics?.proof_of_delivery_count)} />
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <Panel title="Matching materializado" icon={<BarChart3 />} items={(runs || []).map((r: any) => ({ title: `${number(r.allocated_insertions)} / ${number(r.requested_insertions)} inserções`, detail: r.status }))} empty="Nenhuma distribuição executada." />
      <Panel title="Programas e parcerias" icon={<Handshake />} items={(programs || []).map((p: any) => ({ title: p.name, detail: `${p.program_type} · ${p.reward_type} · ${p.status}` }))} empty="Nenhum programa disponível." />
      <Panel title="Eventos" icon={<CalendarDays />} items={(events || []).map((e: any) => ({ title: e.name, detail: `${new Date(e.starts_at).toLocaleDateString('pt-BR')} · ${e.status}` }))} empty="Nenhum evento cadastrado." />
      <Panel title="Canais sociais" icon={<Radio />} items={(channels || []).map((c: any) => ({ title: c.display_name, detail: `${c.provider} · ${c.status} · ${c.participation_enabled ? 'opt-in' : 'fora da rede'}` }))} empty="Meta OAuth aguarda configuração externa." />
    </section>
    <div className="flex flex-wrap gap-3"><Link href="/wallet" className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-bold text-white">Abrir Carteira MPM</Link><Link href="/marketplace" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200">Marketplace</Link></div>
  </div>;
}

function Metric({ icon, label, value, helper }: { icon: React.ReactNode; label: string; value: string; helper?: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between text-purple-400"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>{icon}</div><p className="mt-3 text-3xl font-black text-white">{value}</p>{helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}</div>; }
function Panel({ title, icon, items, empty }: { title: string; icon: React.ReactNode; items: Array<{ title: string; detail: string }>; empty: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="flex items-center gap-2 font-bold text-white"><span className="text-purple-400">{icon}</span>{title}</h2><div className="mt-4 space-y-2">{items.length ? items.map((item, i) => <div key={i} className="rounded-xl bg-slate-950 p-3"><p className="text-sm font-semibold text-slate-200">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div>) : <p className="py-5 text-center text-sm text-slate-500">{empty}</p>}</div></div>; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center"><h1 className="text-xl font-bold text-white">{title}</h1><p className="mt-2 text-sm text-slate-400">{text}</p></div>; }
