import { redirect } from 'next/navigation';
import { CheckCircle2, CreditCard, Monitor, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { contractExpansionPlanAction } from '@/app/actions/expansion';
import { cookies } from 'next/headers';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export default async function PlansPage() {
  const supabase = createClient();
  const capturedReferral = cookies().get('mpm_ref')?.value || '';
  const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login');
  const [{ data: plans }, { data: links }, { data: subscriptions }] = await Promise.all([
    (supabase.from('expansion_plans') as any).select('*,expansion_plan_versions(*)').eq('status','active').eq('public_available',true).order('display_order'),
    (supabase.from('company_users') as any).select('company_id,companies(id,trade_name)').eq('user_id',user.id).eq('is_active',true),
    (supabase.from('company_plan_subscriptions') as any).select('id,company_id,status,requested_screens,contracted_amount_cents,next_charge_at,expansion_plans(name)').in('status',['pending_payment','active','past_due','suspended']),
  ]);
  const companies = (links || []).map((link:any) => Array.isArray(link.companies) ? link.companies[0] : link.companies).filter(Boolean);
  return <div className="mx-auto max-w-7xl space-y-8">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-400">Planos de expansão</p><h1 className="mt-2 text-3xl font-black text-white">Escolha o tamanho da sua rede</h1><p className="mt-2 text-sm text-slate-400">Uma assinatura por empresa, com slots independentes para cada TV. Valores e benefícios são congelados na contratação.</p></header>
    {(subscriptions || []).length > 0 && <section className="grid gap-4 md:grid-cols-2">{(subscriptions || []).map((s:any) => <div key={s.id} className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5"><p className="text-xs font-bold uppercase text-cyan-300">Meu plano</p><h2 className="mt-2 text-xl font-bold text-white">{s.expansion_plans?.name || 'Plano MPM'} · {s.requested_screens} TVs</h2><p className="mt-2 text-sm text-slate-400">{money(Number(s.contracted_amount_cents))} · {s.status}{s.next_charge_at ? ` · próxima cobrança ${new Date(s.next_charge_at).toLocaleDateString('pt-BR')}` : ''}</p></div>)}</section>}
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">{(plans || []).map((plan:any) => {
      const versions=(plan.expansion_plan_versions || []).filter((v:any)=>!v.effective_to).sort((a:any,b:any)=>b.version-a.version); const v=versions[0]; if(!v) return null;
      const economy=v.included_screens*14900-v.monthly_price_cents;
      return <article key={plan.id} className={`flex flex-col rounded-3xl border p-5 ${plan.featured?'border-purple-400 bg-purple-500/10 shadow-xl shadow-purple-500/10':'border-slate-800 bg-slate-900'}`}>
        {plan.featured && <span className="mb-3 w-fit rounded-full bg-purple-400 px-2.5 py-1 text-[10px] font-black uppercase text-slate-950">Destaque</span>}
        <h2 className="text-xl font-black text-white">{plan.name}</h2><p className="mt-2 min-h-10 text-xs leading-5 text-slate-400">{plan.description}</p>
        <p className="mt-5 text-3xl font-black text-white">{money(v.monthly_price_cents)}<span className="text-xs font-medium text-slate-500">/mês</span></p>
        {economy>0 && <p className="mt-1 text-xs font-bold text-emerald-400">Economia de {money(economy)} sobre TVs avulsas</p>}
        <div className="my-5 h-px bg-slate-800"/><ul className="flex-1 space-y-3 text-xs text-slate-300">
          <li className="flex gap-2"><Monitor className="h-4 w-4 text-cyan-400"/>{v.included_screens} TV(s) incluída(s)</li>
          <li className="flex gap-2"><Sparkles className="h-4 w-4 text-purple-400"/>Até {v.preferred_location_limit} locais preferenciais</li>
          <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400"/>TV adicional: {money(v.extra_screen_price_cents)}</li>
          <li className="flex gap-2"><CreditCard className="h-4 w-4 text-amber-400"/>2ª cobrança após {v.days_until_second_charge} dias</li>
        </ul>
        {companies.length>0 && <form action={async(formData)=>{'use server'; await contractExpansionPlanAction(formData);}} className="mt-6 space-y-2">
          <input type="hidden" name="plan_code" value={plan.code}/><select name="company_id" required className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">{companies.map((c:any)=><option key={c.id} value={c.id}>{c.trade_name}</option>)}</select>
          <input name="requested_screens" type="number" min={v.included_screens} max={v.max_screens || 99} defaultValue={v.included_screens} aria-label="Quantidade de TVs" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/>
          <input name="attribution_code" defaultValue={capturedReferral} placeholder="Código do Parceiro (opcional)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"/>
          <select name="billing_type" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"><option value="PIX">PIX</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão</option></select>
          <button className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-xs font-black text-slate-950 hover:bg-cyan-300">Contratar este plano</button>
        </form>}
      </article>})}</section>
  </div>;
}
