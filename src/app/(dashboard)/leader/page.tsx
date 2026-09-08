import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { inviteCreatorAction } from '@/app/actions/expansion';

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);

export default async function LeaderPage(){
 const supabase=createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect('/login');
 const {data:leader}=await (supabase.from('affiliate_profiles') as any).select('*').eq('user_id',user.id).eq('status','active').maybeSingle();
 if(!leader) return <Empty/>;
 const [{data:relations},{data:commissions},{data:candidates}]=await Promise.all([
  (supabase.from('affiliate_relationships') as any).select('creator_affiliate_id,status,starts_at,affiliate_profiles!affiliate_relationships_creator_affiliate_id_fkey(display_name,attribution_code)').eq('leader_affiliate_id',leader.id).eq('status','active'),
  (supabase.from('expansion_commission_entries') as any).select('amount_cents,status,entry_kind,created_at').eq('beneficiary_affiliate_id',leader.id).eq('beneficiary_role','leader').order('created_at',{ascending:false}),
  (supabase.from('affiliate_profiles') as any).select('id,display_name,attribution_code').eq('status','active').neq('id',leader.id).limit(100),
 ]);
 const ids=(relations||[]).map((r:any)=>r.creator_affiliate_id);
 const [{data:slots},{data:subscriptions}]=await Promise.all([
  ids.length?(supabase.from('subscription_screen_slots') as any).select('id,status,creator_affiliate_id,company_plan_subscriptions(companies(trade_name))').in('creator_affiliate_id',ids):Promise.resolve({data:[]}),
  ids.length?(supabase.from('company_plan_subscriptions') as any).select('id,status,origin_creator_affiliate_id,companies(trade_name),requested_screens').in('origin_creator_affiliate_id',ids):Promise.resolve({data:[]}),
 ]);
 const active=(slots||[]).filter((s:any)=>s.status==='active').length; const pending=(slots||[]).filter((s:any)=>s.status!=='active'&&s.status!=='cancelled').length;
 const available=(commissions||[]).filter((c:any)=>c.status==='available_pending_transfer').reduce((n:number,c:any)=>n+Number(c.amount_cents),0);
 return <div className="mx-auto max-w-7xl space-y-7"><header><p className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">Líder MPM</p><h1 className="mt-2 text-3xl font-black text-white">Minha equipe</h1><p className="mt-1 text-sm text-slate-400">Acompanhe produção e ativação sem acessar dados sensíveis das empresas.</p></header>
 <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Creators ativos" value={ids.length}/><Metric label="Empresas da equipe" value={subscriptions?.length||0}/><Metric label="TVs ativas" value={active}/><Metric label="Comissão disponível" value={money(available)}/></section>
 <section className="grid gap-5 lg:grid-cols-2"><Panel title="Creators" rows={(relations||[]).map((r:any)=>`${r.affiliate_profiles?.display_name||'Creator'} · ${r.affiliate_profiles?.attribution_code||''}`)}/><Panel title="Onboarding pendente" rows={[`${pending} TV(s) ainda aguardam ativação`,...(subscriptions||[]).filter((s:any)=>s.status!=='active').map((s:any)=>`${s.companies?.trade_name||'Empresa'} · ${s.status}`)]}/><Panel title="Comissões recentes" rows={(commissions||[]).slice(0,12).map((c:any)=>`${c.entry_kind} · ${money(c.amount_cents)} · ${c.status}`)}/>
 <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">Convidar Creator</h2><p className="mt-1 text-xs text-slate-400">Selecione um perfil já cadastrado. O banco impede ciclos, duplicidade de líder e terceiro nível.</p><form action={async(fd)=>{'use server';await inviteCreatorAction(fd)}} className="mt-4 flex gap-2"><input type="hidden" name="leader_affiliate_id" value={leader.id}/><select name="creator_affiliate_id" required className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Selecione</option>{(candidates||[]).filter((c:any)=>!ids.includes(c.id)).map((c:any)=><option key={c.id} value={c.id}>{c.display_name} · {c.attribution_code}</option>)}</select><button className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-950">Convidar</button></form></div></section></div>
}
function Metric({label,value}:{label:string;value:string|number}){return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-white">{value}</p></div>}
function Panel({title,rows}:{title:string;rows:string[]}){return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">{title}</h2><div className="mt-4 space-y-2">{rows.length?rows.map((r,i)=><p key={i} className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">{r}</p>):<p className="py-5 text-sm text-slate-500">Nenhum registro.</p>}</div></div>}
function Empty(){return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10"><h1 className="text-2xl font-black text-white">Líder MPM</h1><p className="mt-2 text-sm text-slate-400">Seu perfil de liderança ainda não foi ativado.</p></div>}
