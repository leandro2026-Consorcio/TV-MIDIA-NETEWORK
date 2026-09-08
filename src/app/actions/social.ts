'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function getSocialConnectionStatusAction(ownerType: 'company' | 'creator' | 'organic_participant', ownerId: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const { data: channels, error } = await (supabase.from('social_channels') as any)
      .select(`
        id, provider, channel_type, provider_channel_id, display_name,
        participation_enabled, requires_approval, publication_mode,
        feed_publish_capable, reel_publish_capable, story_publish_capable,
        insights_capable, metrics_capable,
        max_publications_per_day, max_publications_per_month,
        min_price_credits, min_lead_time_hours, min_retention_days,
        allowed_hours, blocked_categories, blocked_companies,
        diagnostic_status, diagnostic_message, status, updated_at,
        connection_id,
        social_connections (id, provider, status, scopes, connected_at, expires_at)
      `)
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };

    return { success: true, channels: channels || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao carregar canais sociais.' };
  }
}

export async function updateSocialChannelRulesAction(input: {
  channelId: string;
  publicationMode: 'manual' | 'approval' | 'automatic';
  maxPublicationsPerDay?: number;
  maxPublicationsPerMonth?: number;
  minPriceCredits?: number;
  minLeadTimeHours?: number;
  minRetentionDays?: number;
  allowedHours?: { start: string; end: string };
  blockedCategories?: string[];
  blockedCompanies?: string[];
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const updateData: Record<string, any> = {
      publication_mode: input.publicationMode,
      updated_at: new Date().toISOString(),
    };

    if (input.maxPublicationsPerDay !== undefined) updateData.max_publications_per_day = input.maxPublicationsPerDay;
    if (input.maxPublicationsPerMonth !== undefined) updateData.max_publications_per_month = input.maxPublicationsPerMonth;
    if (input.minPriceCredits !== undefined) updateData.min_price_credits = input.minPriceCredits;
    if (input.minLeadTimeHours !== undefined) updateData.min_lead_time_hours = input.minLeadTimeHours;
    if (input.minRetentionDays !== undefined) updateData.min_retention_days = input.minRetentionDays;
    if (input.allowedHours !== undefined) updateData.allowed_hours = input.allowedHours;
    if (input.blockedCategories !== undefined) updateData.blocked_categories = input.blockedCategories;
    if (input.blockedCompanies !== undefined) updateData.blocked_companies = input.blockedCompanies;

    const { error } = await (supabase.from('social_channels') as any)
      .update(updateData)
      .eq('id', input.channelId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/creator');
    revalidatePath('/marketplace');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao atualizar regras do canal.' };
  }
}

export async function setChannelParticipationAction(channelId: string, enabled: boolean) {
  try {
    const supabase = createClient();
    const { data, error } = await (supabase.rpc as any)('set_social_channel_participation', {
      p_channel_id: channelId,
      p_enabled: enabled,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath('/creator');
    revalidatePath('/marketplace');
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao alterar participação do canal.' };
  }
}

export async function disconnectSocialConnectionAction(connectionId: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const admin = createAdminClient();
    await (admin.from('social_connections') as any)
      .update({
        status: 'revoked',
        encrypted_access_token: null,
        metadata: { revoked_at: new Date().toISOString(), revoked_by: user.id },
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    await (admin.from('social_channels') as any)
      .update({
        participation_enabled: false,
        status: 'revoked',
        diagnostic_status: 'revoked',
        diagnostic_message: 'Conexão revogada pelo usuário.',
        updated_at: new Date().toISOString(),
      })
      .eq('connection_id', connectionId);

    revalidatePath('/creator');
    revalidatePath('/marketplace');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao desconectar.' };
  }
}
