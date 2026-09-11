import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function ReferralLanding({ params }: { params: { code: string } }) {
  const admin = createAdminClient();
  const { data: feature } = await (admin.from('platform_settings') as any).select('value').eq('key', 'creator_referral_leads_enabled').maybeSingle();
  if (!(feature?.value === true || feature?.value === 'true')) notFound();
  const { data: referral } = await (admin.from as any)('campaign_referrals')
    .select('public_code,status,attribution_expires_at,campaigns(name,description,landing_mode,landing_url,landing_fields,companies(trade_name))')
    .eq('public_code', params.code.toUpperCase()).maybeSingle();
  if (!referral || referral.status !== 'active' || new Date(referral.attribution_expires_at) <= new Date()) notFound();
  const campaign = referral.campaigns;
  if (campaign.landing_mode === 'external' && campaign.landing_url) {
    return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-black">{campaign.name}</h1><p className="mt-3">Continue no site oficial da campanha.</p><a className="mt-6 inline-block rounded-xl bg-purple-600 px-5 py-3 font-bold text-white" href={campaign.landing_url} rel="noopener noreferrer">Continuar</a></main>;
  }
  return <main className="min-h-screen bg-slate-950 px-5 py-12 text-white"><div className="mx-auto max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-7"><p className="text-xs font-black uppercase tracking-widest text-purple-400">Indicação MPM</p><h1 className="mt-2 text-3xl font-black">{campaign.name}</h1><p className="mt-2 text-slate-400">{campaign.description}</p><p className="mt-1 text-sm text-slate-500">{campaign.companies?.trade_name}</p><form action="/api/referrals/leads" method="post" className="mt-7 space-y-4"><input type="hidden" name="code" value={referral.public_code}/><input required name="name" placeholder="Nome" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/><input required name="phone" inputMode="tel" placeholder="Telefone / WhatsApp" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/><input name="email" type="email" placeholder="E-mail (opcional)" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/><input name="city" placeholder="Cidade" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/><label className="flex gap-3 text-sm text-slate-300"><input required type="checkbox" name="consent" value="yes"/>Autorizo o contato para esta campanha conforme a Política de Privacidade.</label><button className="w-full rounded-xl bg-purple-600 py-3 font-black">Quero receber contato</button></form></div></main>;
}
