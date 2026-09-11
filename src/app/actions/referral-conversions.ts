'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function getReferralDashboardAction() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const [{ data: profile }, { data: companies }, { data: creator }, { data: flags }] = await Promise.all([
    (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).maybeSingle(),
    (supabase.from('companies') as any).select('id,trade_name'),
    (supabase.from('creator_profiles') as any).select('id,display_name').eq('user_id', user.id).maybeSingle(),
    (supabase.from('platform_settings') as any).select('key,value').in('key', ['creator_referral_leads_enabled','external_lead_api_enabled','conversion_commissions_enabled','commission_billing_enabled','creator_cash_payout_enabled']),
  ]);
  const companyIds = (companies || []).map((row: any) => row.id);
  const [{ data: franchiseRows }, { data: referrals }, { data: creatorFunnel }, { data: commissions }, { data: closings }, { data: payables }] = await Promise.all([
    companyIds.length ? (supabase.from as any)('franchises').select('id,company_id,code,billing_frequency,status,franchise_networks(name)').in('company_id', companyIds) : Promise.resolve({ data: [] }),
    (supabase.from as any)('campaign_referrals').select('id,public_code,status,attribution_expires_at,campaigns(name),creator_profiles(display_name)').order('created_at', { ascending: false }).limit(30),
    creator ? (supabase.rpc as any)('get_my_referral_funnel') : Promise.resolve({ data: [] }),
    (supabase.from as any)('conversion_commissions').select('id,gross_commission_amount,mpm_fee_amount,creator_net_amount,status,currency,eligible_at,campaigns(name)').order('created_at', { ascending: false }).limit(100),
    (supabase.from as any)('commission_closings').select('id,period_start,period_end,gross_amount,fee_amount,creator_net_amount,status,simulation_only,franchises(code)').order('created_at', { ascending: false }).limit(30),
    creator ? (supabase.from as any)('creator_payables').select('id,amount,currency,status,simulation_only,created_at').eq('creator_id', creator.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  return { success: true as const, isMaster: Boolean(profile?.is_master_admin), companies: companies || [], creator, franchises: franchiseRows || [], referrals: referrals || [], creatorFunnel: creatorFunnel || [], commissions: commissions || [], closings: closings || [], payables: payables || [], flags: Object.fromEntries((flags || []).map((row: any) => [row.key, row.value === true || row.value === 'true'])) };
}

export async function ensureReferralForAcceptanceAction(acceptanceId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data, error } = await (supabase.rpc as any)('ensure_campaign_referral', { p_acceptance_id: acceptanceId, p_idempotency_key: crypto.randomUUID() });
  if (error) return { success: false as const, error: error.message };
  revalidatePath('/referrals');
  return { success: true as const, referralId: data };
}

export async function configureReferralCampaignAction(input: { campaignId: string; companyId: string; franchiseId?: string; attributionDays: number; triggerEvent: string; conversionEvent: string; grossCommission: number; feeRate?: number }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data: membership } = await (supabase.from('company_users') as any).select('id').eq('company_id', input.companyId).eq('user_id', user.id).eq('is_active', true).in('role', ['owner','admin']).maybeSingle();
  const { data: profile } = await (supabase.from('profiles') as any).select('is_master_admin').eq('id', user.id).maybeSingle();
  if (!membership && !profile?.is_master_admin) return { success: false as const, error: 'Acesso negado.' };
  const admin = createAdminClient();
  const { data: campaign } = await (admin.from('campaigns') as any).select('id,company_id').eq('id', input.campaignId).eq('company_id', input.companyId).maybeSingle();
  if (!campaign) return { success: false as const, error: 'Campanha inválida.' };
  let { data: program } = await (admin.from('partner_programs') as any).select('id').eq('owner_company_id', input.companyId).eq('program_type', 'influencer').maybeSingle();
  if (!program) ({ data: program } = await (admin.from('partner_programs') as any).insert({ owner_company_id: input.companyId, code: `REF-${input.companyId.slice(0,8).toUpperCase()}`, name: 'Programa de Indicação e Conversão', program_type: 'influencer', attribution_window_days: input.attributionDays, reward_type: 'fixed', reward_value: input.grossCommission, status: 'active' }).select('id').single());
  const version = `v-${Date.now()}`;
  const { data: attribution } = await (admin.from as any)('referral_attribution_rule_versions').insert({ program_id: program.id, version, strategy: 'first_valid_lead', attribution_window_days: input.attributionDays, dedupe_fields: ['phone_hash','email_hash'], risk_configuration: { self_referral: 'review', repeated_lead: 'possible_duplicate' }, created_by: user.id }).select('id').single();
  const { data: rule } = await (admin.from as any)('conversion_commission_rule_versions').insert({ program_id: program.id, franchise_id: input.franchiseId || null, campaign_id: input.campaignId, version, calculation_mode: 'fixed', fixed_amount: input.grossCommission, mpm_fee_rate: input.feeRate ?? 10, commission_trigger_event: input.triggerEvent, created_by: user.id }).select('id').single();
  const { error } = await (admin.from as any)('campaign_referral_settings').upsert({ campaign_id: input.campaignId, program_id: program.id, franchise_id: input.franchiseId || null, attribution_rule_version_id: attribution.id, landing_mode: 'mpm', commission_trigger_event: input.triggerEvent, conversion_event: input.conversionEvent, status: 'active' });
  if (error || !rule) return { success: false as const, error: error?.message || 'Não foi possível configurar.' };
  await (admin.from('campaigns') as any).update({ result_modes: ['media','referral','conversion','hybrid'], referral_franchise_id: input.franchiseId || null, commission_trigger_event: input.triggerEvent }).eq('id', input.campaignId);
  revalidatePath('/referrals');
  return { success: true as const };
}
