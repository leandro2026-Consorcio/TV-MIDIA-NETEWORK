import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const money = (value: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
const sum = (rows:any[], status?:string[]) => rows.filter(r=>!status || status.includes(r.status)).reduce((n,r)=>n+Number(r.amount_cents||0),0);

export default async function CreatorPage() {
  const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
  const [{data:creator},{data:affiliate}] = await Promise.all([
    (supabase.from('creator_profiles') as any).select('*').eq('user_id',user.id).maybeSingle(),
    (supabase.from('affiliate_profiles') as any).select('*').eq('user_id',user.id).eq('status','active').maybeSingle(),
  ]);
  if(!affiliate) return <Empty title="Creator Parceiro" text="Seu Código do Parceiro ainda não foi ativado. O Master ou seu Líder pode concluir este cadastro sem alterar seu perfil empresarial."/>;
  const [{data:subscriptions},{data:slots},{data:commissions},{data:entitlements},{data:relationship}] = await Promise.all([
    (supabase.from('company_plan_subscriptions') as any).select('id,status,requested_screens,contracted_amount_cents,companies(trade_name),expansion_plans(name)').eq('origin_creator_affiliate_id',affiliate.id).order('created_at',{ascending:false}),
    (supabase.from('subscription_screen_slots') as any).select('id,status,activated_at,screen_id,subscription_id,screens(name),company_plan_subscriptions(companies(trade_name))').eq('creator_affiliate_id',affiliate.id),
    (supabase.from('expansion_commission_entries') as any).select('*').eq('beneficiary_affiliate_id',affiliate.id).eq('beneficiary_role','creator').order('created_at',{ascending:false}),
    (supabase.from('inventory_entitlements') as any).select('*,entitlement_periods(*)').eq('beneficiary_type','affiliate').eq('beneficiary_id',affiliate.id),
    (supabase.from('affiliate_relationships') as any).select('leader_affiliate_id,affiliate_profiles!affiliate_relationships_leader_affiliate_id_fkey(display_name)').eq('creator_affiliate_id',affiliate.id).eq('status','active').maybeSingle(),
  ]);
  const link=`https://midiapormidia.com.br/?ref=${encodeURIComponent(affiliate.attribution_code)}`;
  const active=(slots||[]).filter((s:any)=>s.status==='active').length; const pending=(slots||[]).filter((s:any)=>s.status!=='active'&&s.status!=='cancelled').length;
  return <div className="mx-auto max-w-7xl space-y-7">
    <header><p className="text-xs font-bold uppercase tracking-[.25em] text-fuchsia-400">Creator Parceiro</p><h1 className="mt-2 text-3xl font-black text-white">Minha expansão</h1><p className="mt-1 text-sm text-slate-400">{creator?.display_name||affiliate.display_name}{relationship?.affiliate_profiles?.display_name?` · Equipe ${relationship.affiliate_profiles.display_name}`:''}</p></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Empresas indicadas" value={subscriptions?.length||0}/><Metric label="TVs ativas" value={active}/><Metric label="TVs pendentes" value={pending}/><Metric label="Comissão disponível" value={money(sum(commissions||[],['available_pending_transfer']))}/></section>
    <section className="grid gap-5 lg:grid-cols-[1.4fr_.6fr]"><div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">Código do Parceiro</h2><div className="mt-4 rounded-xl bg-slate-950 p-4"><p className="text-2xl font-black text-fuchsia-400">{affiliate.attribution_code}</p><p className="mt-2 break-all text-xs text-slate-400">{link}</p></div><p className="mt-3 text-xs text-slate-500">Este código registra a origem. Ele só concede desconto quando uma promoção estiver configurada.</p></div><div className="rounded-2xl border border-slate-800 bg-white p-4 text-center"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`} alt="QR do Código do Parceiro" className="mx-auto aspect-square w-full max-w-[190px]"/><p className="mt-2 text-xs font-bold text-slate-800">Escaneie para indicar</p></div></section>
    <section className="grid gap-5 lg:grid-cols-2"><Panel title="Empresas e planos" rows={(subscriptions||[]).map((s:any)=>`${s.companies?.trade_name||'Empresa'} · ${s.expansion_plans?.name||'Plano'} · ${s.status}`)}/><Panel title="Ativação das TVs" rows={(slots||[]).map((s:any)=>`${s.company_plan_subscriptions?.companies?.trade_name||'Empresa'} · ${s.screens?.name||'TV aguardando instalação'} · ${s.status}`)}/><Panel title="Comissões" rows={(commissions||[]).slice(0,12).map((c:any)=>`${c.entry_kind} · ${money(c.amount_cents)} · ${c.status}`)}/><Panel title="Minha mídia conquistada" rows={(entitlements||[]).map((e:any)=>`${e.insertion_quantity.toLocaleString('pt-BR')} inserções/${e.recurrence} · ${e.status} · até ${e.ends_at?new Date(e.ends_at).toLocaleDateString('pt-BR'):'sem vencimento'}`)}/></section>
    <div className="flex gap-3"><Link href="/campaigns" className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white">Criar campanha</Link><Link href="/help/getting-started" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200">Ver onboarding</Link></div>
  </div>;
}
function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-white">{value}</p></div>}
function Panel({title,rows}:{title:string;rows:string[]}){return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">{title}</h2><div className="mt-4 space-y-2">{rows.length?rows.map((r,i)=><p key={i} className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">{r}</p>):<p className="py-5 text-sm text-slate-500">Nenhum registro.</p>}</div></div>}
function Empty({title,text}:{title:string;text:string}){return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10"><h1 className="text-2xl font-black text-white">{title}</h1><p className="mt-2 text-sm text-slate-400">{text}</p></div>}
