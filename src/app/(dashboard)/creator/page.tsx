import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function CreatorPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: creator } = await (supabase.from('creator_profiles') as any).select('*').eq('user_id', user.id).maybeSingle();
  if (!creator) return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10"><h1 className="text-2xl font-black text-white">Creator MPM</h1><p className="mt-2 text-sm text-slate-400">Seu perfil creator ainda não foi ativado. O cadastro permanece separado do painel empresarial.</p></div>;
  const [{ data: channels }, { data: offers }, { data: history }, { data: accounts }] = await Promise.all([
    (supabase.from('social_channels') as any).select('id,display_name,provider,status,participation_enabled').eq('owner_type', 'creator').eq('owner_id', creator.id),
    (supabase.from('creator_campaign_offers') as any).select('id,status,offered_credits,created_at').eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(10),
    (supabase.from('creator_score_history') as any).select('*').eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(1),
    (supabase.from('wallet_accounts') as any).select('credit_class,available_balance,pending_balance,reserved_balance').eq('holder_type', 'creator').eq('holder_id', creator.id),
  ]);
  const current = history?.[0]; const available = (accounts || []).reduce((s: number, a: any) => s + Number(a.available_balance || 0), 0);
  return <div className="mx-auto max-w-6xl space-y-7"><header><p className="text-xs font-bold uppercase tracking-[.25em] text-fuchsia-400">Creator Marketplace</p><h1 className="mt-2 text-3xl font-black text-white">{creator.display_name}</h1><p className="mt-1 text-sm text-slate-400">Faixa {creator.tier} · evolução baseada em qualidade operacional e valor de mídia.</p></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Creator Score', creator.creator_score], ['Media Value Score', creator.media_value_score], ['Saldo available', `${available.toLocaleString('pt-BR')} CR`], ['Campanhas', offers?.length || 0]].map(([l,v]) => <div key={String(l)} className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-500">{l}</p><p className="mt-3 text-3xl font-black text-white">{String(v)}</p></div>)}</section>
    <section className="grid gap-5 lg:grid-cols-2"><Box title="Canais" rows={(channels || []).map((c: any) => `${c.display_name} · ${c.provider} · ${c.status}`)} /><Box title="Campanhas oferecidas" rows={(offers || []).map((o: any) => `${o.status} · ${Number(o.offered_credits).toLocaleString('pt-BR')} CR`)} /><Box title="Próximos objetivos" rows={current ? Object.entries(current.next_tier_requirements || {}).map(([k,v]) => `${k}: ${v}`) : ['Aguardando primeiro snapshot de métricas.']} /><Box title="Créditos por classe" rows={(accounts || []).map((a: any) => `${a.credit_class}: ${Number(a.available_balance).toLocaleString('pt-BR')} available`)} /></section>
  </div>;
}
function Box({ title, rows }: { title: string; rows: string[] }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">{title}</h2><div className="mt-4 space-y-2">{rows.length ? rows.map((r,i) => <p key={i} className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">{r}</p>) : <p className="py-5 text-sm text-slate-500">Nenhum registro.</p>}</div></div>; }
