'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const FLAG_KEYS = [
  'multichannel_replication_enabled',
  'social_to_tv_replication_enabled',
  'social_crosspost_enabled',
  'multichannel_auto_mode_enabled',
] as const;

export async function getMultichannelDashboardAction() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const [{ data: companies }, { data: creator }, { data: flags }, { data: capabilities }] = await Promise.all([
    (supabase.from('companies') as any).select('id,trade_name').order('trade_name'),
    (supabase.from('creator_profiles') as any).select('id,display_name').eq('user_id', user.id).maybeSingle(),
    (supabase.from('platform_settings') as any).select('key,value').in('key', [...FLAG_KEYS]),
    (supabase.from('multichannel_provider_capabilities') as any).select('*').order('provider'),
  ]);
  const companyIds = (companies || []).map((row: any) => row.id);
  const ownerIds = [...companyIds, ...(creator?.id ? [creator.id] : [])];
  const [{ data: channels }, { data: screens }, { data: playlists }, { data: campaigns }, { data: rules }, { data: approvals }, { data: events }] = await Promise.all([
    ownerIds.length ? (supabase.from('social_channels') as any).select('id,owner_type,owner_id,provider,display_name,status,direct_post_capable').in('owner_id', ownerIds).eq('status', 'active') : Promise.resolve({ data: [] }),
    companyIds.length ? (supabase.from('screens') as any).select('id,company_id,name,orientation,status,venue_type').in('company_id', companyIds).neq('venue_type', 'residential') : Promise.resolve({ data: [] }),
    companyIds.length ? (supabase.from('playlists') as any).select('id,company_id,name,orientation,status').in('company_id', companyIds).neq('status', 'archived') : Promise.resolve({ data: [] }),
    companyIds.length ? (supabase.from('campaigns') as any).select('id,company_id,name,status').in('company_id', companyIds).order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    ownerIds.length ? (supabase.from('multichannel_rules') as any).select('*,multichannel_rule_targets(*)').in('owner_id', ownerIds).order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    ownerIds.length ? (supabase.from('multichannel_approval_tasks') as any).select('*,propagation_targets(target_key,target_type,target_provider,status)').in('owner_id', ownerIds).eq('status', 'pending').order('expires_at') : Promise.resolve({ data: [] }),
    ownerIds.length ? (supabase.from('propagation_events') as any).select('id,owner_type,owner_id,source_kind,source_provider,detection_mode,status,depth,created_at').in('owner_id', ownerIds).order('created_at', { ascending: false }).limit(25) : Promise.resolve({ data: [] }),
  ]);

  return {
    success: true as const, companies: companies || [], creator: creator || null, channels: channels || [], screens: screens || [],
    playlists: playlists || [], campaigns: campaigns || [], rules: rules || [], approvals: approvals || [], events: events || [], capabilities: capabilities || [],
    flags: Object.fromEntries((flags || []).map((row: any) => [row.key, row.value === true || row.value === 'true'])),
  };
}

export async function createMultichannelRuleFormAction(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado.');
  const owner = String(formData.get('owner') || '').split(':');
  const source = String(formData.get('source') || 'mpm').split(':');
  const destinations = formData.getAll('destinations').map(String);
  if (owner.length !== 2 || !destinations.length) throw new Error('Owner e destino são obrigatórios.');
  const targets = destinations.map(value => {
    const [targetType, id, provider] = value.split(':');
    return {
      target_type: targetType,
      target_key: value,
      target_provider: targetType === 'social' ? provider : null,
      target_social_channel_id: targetType === 'social' ? id : null,
      target_screen_id: targetType === 'tv' ? id : null,
      target_playlist_id: targetType === 'playlist' ? id : null,
      target_format: targetType === 'tv' || targetType === 'playlist' ? 'tv_16_9' : 'feed',
      requires_canonical_asset: true,
    };
  });
  const mode = String(formData.get('mode') || 'approval');
  const startsAt = String(formData.get('starts_at') || '') || null;
  const endsAt = String(formData.get('ends_at') || '') || null;
  const eligibility = String(formData.get('eligibility_mode') || 'campaigns_mpm');
  const { error } = await (supabase.rpc as any)('create_multichannel_rule', {
    p_owner_type: owner[0], p_owner_id: owner[1], p_name: String(formData.get('name') || ''),
    p_source_kind: source[0], p_source_social_channel_id: source[0] === 'social' ? source[1] : null,
    p_source_screen_id: source[0] === 'tv' ? source[1] : null, p_campaign_id: String(formData.get('campaign_id') || '') || null,
    p_eligibility_mode: eligibility, p_required_hashtag: String(formData.get('required_hashtag') || '') || null,
    p_mode: mode, p_starts_at: startsAt, p_ends_at: endsAt, p_fallback_mode: String(formData.get('fallback_mode') || 'approval'),
    p_timezone: 'America/Cuiaba', p_filters: { advanced_confirmed: eligibility === 'all_eligible' && formData.get('advanced_confirmed') === 'on' }, p_targets: targets,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/multichannel-automations');
}

export async function decideMultichannelApprovalFormAction(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado.');
  const { error } = await (supabase.rpc as any)('decide_multichannel_approval', {
    p_task_id: String(formData.get('task_id') || ''), p_approve: formData.get('decision') === 'approve', p_note: null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/multichannel-automations');
}
