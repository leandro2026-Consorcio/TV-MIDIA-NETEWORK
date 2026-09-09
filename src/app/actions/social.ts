'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSocialToken, encryptSocialToken } from '@/lib/social-token-crypto';
import { getProviderConfig } from '@/lib/social/meta';

export async function getSocialConnectionStatusAction(
  ownerType: 'company' | 'creator' | 'organic_participant',
  ownerId: string
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const { data: channels, error } = await (supabase.from('social_channels') as any)
      .select(`
        id, provider, channel_type, provider_channel_id, display_name, username, avatar_url,
        auth_flow, participation_enabled, requires_approval, publication_mode,
        feed_publish_capable, reel_publish_capable, story_publish_capable,
        insights_capable, metrics_capable,
        max_publications_per_day, max_publications_per_month,
        min_price_credits, min_lead_time_hours, min_retention_days,
        allowed_hours, blocked_categories, blocked_companies,
        diagnostic_status, diagnostic_message, status, updated_at,
        connection_id,
        social_connections (id, provider, auth_flow, status, scopes, connected_at, expires_at, last_refreshed_at)
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
    revalidatePath('/company/social');
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
    revalidatePath('/company/social');
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
    revalidatePath('/company/social');
    revalidatePath('/marketplace');
    revalidatePath('/admin/social-diagnostics');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao desconectar.' };
  }
}

export async function ensureCanonicalCreatorAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const admin = createAdminClient();
    const { data: creatorId, error } = await (admin.rpc as any)('ensure_canonical_creator_profile', {
      p_user_id: user.id,
    });

    if (error) return { success: false, error: error.message };
    revalidatePath('/creator');
    return { success: true, creatorId };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao resolver perfil Creator.' };
  }
}

export async function getSocialDiagnosticsAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const admin = createAdminClient();
    const { data, error } = await (admin.rpc as any)('get_social_diagnostics_for_master');

    if (error) {
      // Fallback manual se a RPC não estiver disponível
      const { data: connections } = await (admin.from('social_connections') as any)
        .select(`
          id, owner_type, owner_id, provider, auth_flow, provider_account_id, scopes, status,
          connected_at, expires_at, last_refreshed_at,
          social_channels (
            id, channel_type, display_name, username, diagnostic_status, diagnostic_message,
            feed_publish_capable, reel_publish_capable, story_publish_capable, insights_capable, metrics_capable,
            last_diagnosed_at
          )
        `)
        .order('created_at', { ascending: false });

      const diagnostics = (connections || []).map((conn: any) => {
        const ch = conn.social_channels?.[0] || {};
        return {
          connection_id: conn.id,
          channel_id: ch.id,
          owner_type: conn.owner_type,
          owner_id: conn.owner_id,
          owner_name: conn.owner_type === 'creator' ? 'Creator MPM' : (conn.owner_type === 'company' ? 'Empresa' : 'Participante'),
          provider: conn.provider,
          auth_flow: conn.auth_flow,
          channel_type: ch.channel_type || 'facebook_page',
          display_name: ch.display_name || 'Canal Social',
          username: ch.username || '',
          provider_account_id_masked: conn.provider_account_id ? `${conn.provider_account_id.slice(0, 3)}****` : '****',
          scopes: conn.scopes || [],
          status: conn.status,
          diagnostic_status: ch.diagnostic_status || 'connected',
          diagnostic_message: ch.diagnostic_message || 'OK',
          feed_publish_capable: ch.feed_publish_capable || false,
          reel_publish_capable: ch.reel_publish_capable || false,
          story_publish_capable: ch.story_publish_capable || false,
          insights_capable: ch.insights_capable || false,
          metrics_capable: ch.metrics_capable || false,
          connected_at: conn.connected_at,
          expires_at: conn.expires_at,
          last_refreshed_at: conn.last_refreshed_at,
          last_diagnosed_at: ch.last_diagnosed_at,
        };
      });

      return { success: true, diagnostics };
    }

    return { success: true, diagnostics: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao carregar diagnósticos sociais.' };
  }
}

export async function verifySocialConnectionAction(connectionId: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const admin = createAdminClient();
    const { data: conn } = await (admin.from('social_connections') as any)
      .select('id, provider, auth_flow, encrypted_access_token, expires_at, status')
      .eq('id', connectionId)
      .single();

    if (!conn) return { success: false, error: 'Conexão não encontrada.' };

    if (!conn.encrypted_access_token || conn.status === 'revoked') {
      await (admin.from('social_channels') as any)
        .update({
          diagnostic_status: 'revoked',
          diagnostic_message: 'Conexão revogada pelo usuário.',
          last_diagnosed_at: new Date().toISOString(),
        })
        .eq('connection_id', connectionId);

      revalidatePath('/admin/social-diagnostics');
      return { success: true, status: 'revoked', message: 'Conexão está revogada.' };
    }

    // Verifica expiração simples por data
    if (conn.expires_at && new Date(conn.expires_at).getTime() < Date.now()) {
      await (admin.from('social_connections') as any)
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', connectionId);

      await (admin.from('social_channels') as any)
        .update({
          diagnostic_status: 'expired_token',
          diagnostic_message: 'Token expirado. É necessária a reconexão.',
          last_diagnosed_at: new Date().toISOString(),
        })
        .eq('connection_id', connectionId);

      revalidatePath('/admin/social-diagnostics');
      return { success: true, status: 'expired', message: 'Token expirou.' };
    }

    // Token válido dentro do prazo
    await (admin.from('social_channels') as any)
      .update({
        diagnostic_status: 'ready_for_campaigns',
        diagnostic_message: 'Conexão íntegra e ativa para veiculação.',
        last_diagnosed_at: new Date().toISOString(),
      })
      .eq('connection_id', connectionId);

    revalidatePath('/admin/social-diagnostics');
    return { success: true, status: 'active', message: 'Conexão íntegra e pronta.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao verificar conexão.' };
  }
}

export async function refreshSocialTokenAction(connectionId: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Não autenticado.' };

    const admin = createAdminClient();
    const { data: conn } = await (admin.from('social_connections') as any)
      .select('*')
      .eq('id', connectionId)
      .single();

    if (!conn || !conn.encrypted_access_token) {
      return { success: false, error: 'Conexão não encontrada ou sem token ativo.' };
    }

    let token = '';
    try {
      token = decryptSocialToken(conn.encrypted_access_token);
    } catch {
      return { success: false, error: 'Erro ao decifrar token local.' };
    }

    const config = getProviderConfig(conn.provider);
    if (!config) return { success: false, error: 'Configuração do provedor indisponível.' };

    let newExpiresAt: string | null = null;
    let newToken = token;

    if (conn.auth_flow === 'instagram_login') {
      // Instagram API with Instagram Login: ig_refresh_token
      const refUrl = new URL('https://graph.instagram.com/refresh_access_token');
      refUrl.searchParams.set('grant_type', 'ig_refresh_token');
      refUrl.searchParams.set('access_token', token);

      const res = await fetch(refUrl.toString(), { cache: 'no-store' });
      if (!res.ok) {
        return { success: false, error: 'Provedor rejeitou a renovação do token de Instagram.' };
      }
      const data = await res.json() as { access_token: string; expires_in?: number };
      newToken = data.access_token;
      const expiresIn = data.expires_in || 60 * 86400;
      newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    } else {
      // Facebook Login: fb_exchange_token
      const refUrl = new URL(`https://graph.facebook.com/${config.graphVersion}/oauth/access_token`);
      refUrl.searchParams.set('grant_type', 'fb_exchange_token');
      refUrl.searchParams.set('client_id', config.appId);
      refUrl.searchParams.set('client_secret', config.appSecret);
      refUrl.searchParams.set('fb_exchange_token', token);

      const res = await fetch(refUrl.toString(), { cache: 'no-store' });
      if (!res.ok) {
        return { success: false, error: 'Provedor rejeitou a renovação do token do Facebook.' };
      }
      const data = await res.json() as { access_token: string; expires_in?: number };
      newToken = data.access_token;
      if (data.expires_in) {
        newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
      }
    }

    const encrypted = encryptSocialToken(newToken);
    await (admin.from('social_connections') as any)
      .update({
        encrypted_access_token: encrypted,
        expires_at: newExpiresAt,
        last_refreshed_at: new Date().toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId);

    revalidatePath('/admin/social-diagnostics');
    revalidatePath('/creator');
    revalidatePath('/company/social');
    return { success: true, expiresAt: newExpiresAt };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao renovar token.' };
  }
}
