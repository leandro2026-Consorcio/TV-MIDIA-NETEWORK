'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const FLAG_KEYS = [
  'collaborative_media_network_enabled',
  'collaborative_creator_offers_enabled',
  'collaborative_business_channels_enabled',
  'collaborative_campaign_rewards_enabled',
] as const;

export async function getCollaborativeNetworkDashboardAction() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };

  const [{ data: companies }, { data: flags }, { data: creator }, { data: offers }] = await Promise.all([
    (supabase.from('companies') as any).select('id,trade_name,city,state').order('trade_name'),
    (supabase.from('platform_settings') as any).select('key,value').in('key', [...FLAG_KEYS]),
    (supabase.from('creator_profiles') as any).select('id,display_name,city,state,creator_score').eq('user_id', user.id).maybeSingle(),
    (supabase.from('campaign_offers') as any)
      .select('id,campaign_id,offer_type,participant_type,format,region,total_slots,accepted_slots,reward_amount,reward_mode,expires_at,campaigns(name,companies(trade_name))')
      .eq('status', 'offered').order('created_at', { ascending: false }).limit(30),
  ]);
  const companyIds = (companies || []).map((company: any) => company.id);
  const [{ data: campaigns }, { data: channels }, { data: acceptances }, { data: channelSettings }] = await Promise.all([
    companyIds.length
      ? (supabase.from('campaigns') as any).select('*,collaborative_campaign_budget_summary(*),campaign_distribution_rules(*)').in('company_id', companyIds).eq('campaign_type', 'collaborative').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    (supabase.from('social_channels') as any).select('id,owner_type,owner_id,provider,display_name,status,publication_mode,participation_enabled,allowed_formats'),
    creator
      ? (supabase.from('offer_acceptances') as any).select('*,campaign_offers(format,reward_mode),campaigns(name)').eq('participant_type', 'creator').eq('participant_id', creator.id).order('accepted_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    (supabase.from('collaborative_channel_settings') as any)
      .select('id,social_channel_id,participation_enabled,approval_mode,status'),
  ]);
  const settingsByChannel = new Map((channelSettings || []).map((setting: any) => [setting.social_channel_id, setting]));
  const collaborativeChannels = (channels || []).map((channel: any) => {
    const setting: any = settingsByChannel.get(channel.id);
    return {
      ...channel,
      collaborative_setting_id: setting?.id || null,
      participation_enabled: setting?.participation_enabled === true,
      collaborative_approval_mode: setting?.approval_mode || null,
      collaborative_status: setting?.status || null,
    };
  });
  return {
    success: true as const,
    userId: user.id,
    companies: companies || [], campaigns: campaigns || [], channels: collaborativeChannels, creator,
    offers: offers || [], acceptances: acceptances || [],
    flags: Object.fromEntries((flags || []).map((row: any) => [row.key, row.value === true || row.value === 'true'])),
  };
}

export async function createCollaborativeCampaignAction(input: {
  campaignId?: string;
  idempotencyKey?: string;
  companyId: string; name: string; description?: string; startsOn?: string; endsOn?: string;
  rewardMode: 'mpm_credits' | 'media_rights'; budgetTotal: number;
  ownTvs: boolean; ownInstagram: boolean; ownFacebook: boolean; ownTikTok: boolean;
  collaborativeTvs: boolean; collaborativeBusinesses: boolean; collaborativeCreators: boolean;
  recurrence: 'once' | 'daily' | 'weekly' | 'specific_days' | 'custom_period';
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const distributions: any[] = [];
  if (input.ownTvs) distributions.push({ destination_type: 'own_tv', format: 'tv', publication_mode: 'automatic', recurrence_type: input.recurrence, reward_per_delivery: 0 });
  for (const [selected, provider] of [[input.ownInstagram, 'instagram'], [input.ownFacebook, 'facebook'], [input.ownTikTok, 'tiktok']] as const) {
    if (selected) distributions.push({ destination_type: 'own_social', provider, format: provider === 'tiktok' ? 'tiktok_video' : 'feed', publication_mode: provider === 'tiktok' ? 'manual' : 'approval', recurrence_type: input.recurrence, reward_per_delivery: 0 });
  }
  if (input.collaborativeTvs) distributions.push({ destination_type: 'collaborative_tv', format: 'tv', publication_mode: 'automatic', recurrence_type: input.recurrence, budget_limit: input.budgetTotal, reward_per_delivery: 0 });
  if (input.collaborativeBusinesses) distributions.push({ destination_type: 'business_social', provider: 'instagram', format: 'story', publication_mode: 'manual', recurrence_type: input.recurrence, budget_limit: input.budgetTotal, reward_per_delivery: 1 });
  if (input.collaborativeCreators) distributions.push({ destination_type: 'creator_social', provider: 'instagram', format: 'story', publication_mode: 'manual', recurrence_type: input.recurrence, budget_limit: input.budgetTotal, reward_per_delivery: 1 });
  if (!distributions.length) return { success: false as const, error: 'Selecione ao menos um destino.' };
  if (!input.name.trim()) return { success: false as const, error: 'Informe o nome da campanha.' };
  if (input.budgetTotal < 0) return { success: false as const, error: 'O orçamento total não pode ser negativo.' };
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) {
    return { success: false as const, error: 'A data de término não pode ser anterior à data de início.' };
  }

  if (input.campaignId) {
    const { data: campaign } = await (supabase.from('campaigns') as any)
      .select('id,company_id,status')
      .eq('id', input.campaignId)
      .eq('company_id', input.companyId)
      .eq('campaign_type', 'collaborative')
      .maybeSingle();
    if (!campaign) return { success: false as const, error: 'Campanha não encontrada ou acesso negado.' };
    if (campaign.status !== 'draft') return { success: false as const, error: 'Somente campanhas em rascunho podem ser alteradas.' };

    const { error: updateError } = await (supabase.from('campaigns') as any).update({
      name: input.name.trim(), description: input.description?.trim() || null,
      start_date: input.startsOn || null, end_date: input.endsOn || null,
      reward_mode: input.rewardMode, budget_total: input.budgetTotal,
      own_tvs: input.ownTvs, own_social: input.ownInstagram || input.ownFacebook || input.ownTikTok,
      collaborative_tvs: input.collaborativeTvs, collaborative_businesses: input.collaborativeBusinesses,
      collaborative_creators: input.collaborativeCreators, updated_at: new Date().toISOString(),
    }).eq('id', input.campaignId);
    if (updateError) return { success: false as const, error: updateError.message };

    const { error: deleteError } = await (supabase.from('campaign_distribution_rules') as any)
      .delete().eq('campaign_id', input.campaignId).eq('status', 'draft');
    if (deleteError) return { success: false as const, error: deleteError.message };
    const rows = distributions.map((item) => ({
      campaign_id: input.campaignId, destination_type: item.destination_type,
      provider: item.provider || null, format: item.format,
      publication_mode: item.publication_mode, recurrence_type: item.recurrence_type,
      budget_limit: item.budget_limit || 0,
      reward_per_validated_delivery: item.reward_per_delivery || 0,
      starts_at: input.startsOn ? `${input.startsOn}T00:00:00.000Z` : null,
      ends_at: input.endsOn ? `${input.endsOn}T23:59:59.999Z` : null,
      status: 'draft', metadata: { created_from: 'multichannel_wizard' },
    }));
    const { error: rulesError } = await (supabase.from('campaign_distribution_rules') as any).insert(rows);
    if (rulesError) return { success: false as const, error: rulesError.message };
    revalidatePath('/collaborative-network'); revalidatePath('/campaigns');
    return { success: true as const, campaignId: input.campaignId, created: false };
  }
  const { data, error } = await (supabase.rpc as any)('create_collaborative_campaign', {
    p_company_id: input.companyId, p_name: input.name, p_description: input.description || '',
    p_start_date: input.startsOn || null, p_end_date: input.endsOn || null,
    p_reward_mode: input.rewardMode, p_budget_total: input.budgetTotal,
    p_configuration: {
      own_tvs: input.ownTvs, own_social: input.ownInstagram || input.ownFacebook || input.ownTikTok,
      collaborative_tvs: input.collaborativeTvs, collaborative_businesses: input.collaborativeBusinesses,
      collaborative_creators: input.collaborativeCreators, distributions,
    },
    p_idempotency_key: input.idempotencyKey || crypto.randomUUID(),
  });
  if (error) return { success: false as const, error: error.message };
  revalidatePath('/collaborative-network'); revalidatePath('/campaigns');
  return { success: true as const, campaignId: data as string, created: true };
}

export async function acceptCollaborativeOfferAction(offerId: string, participantType: 'creator' | 'company', participantId: string, channelId?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const authorized = participantType === 'creator'
    ? await (supabase.from('creator_profiles') as any).select('id').eq('id', participantId).eq('user_id', user.id).maybeSingle()
    : await (supabase.from('company_users') as any).select('company_id').eq('company_id', participantId).eq('user_id', user.id).eq('is_active', true).maybeSingle();
  if (!authorized.data) return { success: false as const, error: 'Participante não pertence ao usuário autenticado.' };
  const admin = createAdminClient();
  const { data, error } = await (admin.rpc as any)('accept_campaign_offer', {
    p_offer_id: offerId, p_participant_type: participantType, p_participant_id: participantId,
    p_social_channel_id: channelId || null, p_quantity: 1, p_idempotency_key: crypto.randomUUID(),
  });
  if (error) return { success: false as const, error: error.message };
  revalidatePath('/collaborative-network');
  return { success: true as const, result: data };
}

export async function setCollaborativeChannelAction(input: {
  channelId: string; ownerType: 'creator' | 'company'; ownerId: string; enabled: boolean;
  formats: string[]; monthlyLimit: number; minimumReward: number; approvalMode: 'manual' | 'approval' | 'automatic';
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'Usuário não autenticado.' };
  const { data: setting, error } = await (supabase.from('collaborative_channel_settings') as any).upsert({
    social_channel_id: input.channelId, owner_type: input.ownerType, owner_id: input.ownerId,
    participation_enabled: input.enabled, approval_mode: input.approvalMode,
    minimum_reward: input.minimumReward, status: input.enabled ? 'active' : 'paused', updated_at: new Date().toISOString(),
  }, { onConflict: 'social_channel_id' }).select('id').single();
  if (error || !setting) return { success: false as const, error: error?.message || 'Não foi possível configurar o canal.' };
  const { data: channel } = await (supabase.from('social_channels') as any).select('provider').eq('id', input.channelId).single();
  if (!channel) return { success: false as const, error: 'Canal social não encontrado.' };
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  for (const format of input.formats) {
    const { error: inventoryError } = await (supabase.from('collaborative_inventory') as any).upsert({
      channel_setting_id: setting.id, social_channel_id: input.channelId,
      provider: channel.provider, format,
      quantity_limit: input.monthlyLimit, minimum_reward: input.minimumReward,
      period_start: periodStart, period_end: periodEnd,
      capability: input.approvalMode, status: input.enabled ? 'active' : 'paused', updated_at: new Date().toISOString(),
    }, { onConflict: 'social_channel_id,format,period_type,period_start' });
    if (inventoryError) return { success: false as const, error: inventoryError.message };
  }
  revalidatePath('/collaborative-network');
  return { success: true as const };
}
