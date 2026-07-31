'use server';

import { createClient } from '@/lib/supabase/server';

export interface CreateCampaignPayload {
  company_id: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  target_insertions?: number | null;
}

/**
 * 1. Criar Campanha Interna
 */
export async function createCampaignAction(payload: CreateCampaignPayload) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Validar permissão na empresa
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  const isMaster = !!profile?.is_master_admin;

  if (!isMaster) {
    const { data: userLink } = await (supabase.from('company_users') as any)
      .select('company_id')
      .eq('company_id', payload.company_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userLink) {
      return { success: false, error: 'Acesso negado: Você não possui vínculo com esta empresa.' };
    }
  }

  const { data: newCampaign, error } = await (supabase.from('campaigns') as any)
    .insert({
      company_id: payload.company_id,
      name: payload.name,
      description: payload.description || null,
      campaign_type: 'internal',
      status: 'draft',
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      target_insertions: payload.target_insertions || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !newCampaign) {
    return { success: false, error: error?.message || 'Erro ao criar campanha.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: payload.company_id,
    action: 'CAMPAIGN_CREATED',
    details: { campaign_id: newCampaign.id, name: payload.name },
  });

  return { success: true, campaign: newCampaign };
}

/**
 * 2. Atualizar Dados da Campanha
 */
export async function updateCampaignAction(
  campaignId: string,
  payload: {
    name?: string;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    target_insertions?: number | null;
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  if (campaign.status === 'archived') {
    return { success: false, error: 'Campanhas arquivadas não podem ser editadas.' };
  }

  const { error } = await (supabase.from('campaigns') as any)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: campaign.company_id,
    action: 'CAMPAIGN_UPDATED',
    details: { campaign_id: campaignId, changes: payload },
  });

  return { success: true };
}

/**
 * 3. Adicionar Mídia Aprovada à Campanha
 */
export async function addCampaignMediaAction(
  campaignId: string,
  mediaAssetId: string,
  durationSeconds: 5 | 10 | 15 | 30
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  // O Trigger trg_check_campaign_media_integrity no Postgres valida que a mídia é da MESMA empresa e está APROVADA
  const { data: newLink, error } = await (supabase.from('campaign_media') as any)
    .insert({
      campaign_id: campaignId,
      media_asset_id: mediaAssetId,
      playback_duration_seconds: durationSeconds,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: campaign.company_id,
    action: 'CAMPAIGN_MEDIA_ADDED',
    details: { campaign_id: campaignId, media_id: mediaAssetId },
  });

  return { success: true, link: newLink };
}

/**
 * 4. Remover Mídia da Campanha
 */
export async function removeCampaignMediaAction(campaignId: string, mediaAssetId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('company_id')
    .eq('id', campaignId)
    .single();

  const { error } = await (supabase.from('campaign_media') as any)
    .delete()
    .eq('campaign_id', campaignId)
    .eq('media_asset_id', mediaAssetId);

  if (error) {
    return { success: false, error: error.message };
  }

  if (campaign) {
    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      company_id: campaign.company_id,
      action: 'CAMPAIGN_MEDIA_REMOVED',
      details: { campaign_id: campaignId, media_id: mediaAssetId },
    });
  }

  return { success: true };
}

/**
 * 5. Adicionar Tela da Empresa à Campanha
 */
export async function addCampaignScreenAction(campaignId: string, screenId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  // O Trigger trg_check_campaign_screen_integrity no Postgres valida que a tela é da MESMA empresa
  const { data: newLink, error } = await (supabase.from('campaign_screens') as any)
    .insert({
      campaign_id: campaignId,
      screen_id: screenId,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: campaign.company_id,
    action: 'CAMPAIGN_SCREEN_ADDED',
    details: { campaign_id: campaignId, screen_id: screenId },
  });

  return { success: true, link: newLink };
}

/**
 * 6. Remover Tela da Campanha
 */
export async function removeCampaignScreenAction(campaignId: string, screenId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('company_id')
    .eq('id', campaignId)
    .single();

  const { error } = await (supabase.from('campaign_screens') as any)
    .delete()
    .eq('campaign_id', campaignId)
    .eq('screen_id', screenId);

  if (error) {
    return { success: false, error: error.message };
  }

  if (campaign) {
    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      company_id: campaign.company_id,
      action: 'CAMPAIGN_SCREEN_REMOVED',
      details: { campaign_id: campaignId, screen_id: screenId },
    });
  }

  return { success: true };
}

/**
 * 7. Ativar Campanha (Exige perfil Admin ou Master e pelo menos 1 Mídia e 1 Tela)
 */
export async function activateCampaignAction(campaignId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  // Validar Perfil de Admin
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  const isMaster = !!profile?.is_master_admin;

  if (!isMaster) {
    const { data: link } = await (supabase.from('company_users') as any)
      .select('role')
      .eq('company_id', campaign.company_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!link || link.role !== 'admin') {
      return { success: false, error: 'Acesso negado: Apenas administradores da empresa podem ativar campanhas.' };
    }
  }

  // Validar se possui pelo menos 1 mídia vinculada
  const { count: mediaCount } = await (supabase.from('campaign_media') as any)
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  if (!mediaCount || mediaCount === 0) {
    return { success: false, error: 'A campanha precisa ter pelo menos uma mídia aprovada vinculada para ser ativada.' };
  }

  // Validar se possui pelo menos 1 tela vinculada
  const { count: screenCount } = await (supabase.from('campaign_screens') as any)
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  if (!screenCount || screenCount === 0) {
    return { success: false, error: 'A campanha precisa ter pelo menos uma tela vinculada para ser ativada.' };
  }

  const { error } = await (supabase.from('campaigns') as any)
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: campaign.company_id,
    action: 'CAMPAIGN_ACTIVATED',
    details: { campaign_id: campaignId },
  });

  return { success: true };
}

/**
 * 8. Pausar Campanha
 */
export async function pauseCampaignAction(campaignId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('company_id')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  const { error } = await (supabase.from('campaigns') as any)
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: campaign.company_id,
    action: 'CAMPAIGN_PAUSED',
    details: { campaign_id: campaignId },
  });

  return { success: true };
}

/**
 * 9. Arquivar Campanha
 */
export async function archiveCampaignAction(campaignId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('company_id')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  const { error } = await (supabase.from('campaigns') as any)
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: campaign.company_id,
    action: 'CAMPAIGN_ARCHIVED',
    details: { campaign_id: campaignId },
  });

  return { success: true };
}

/**
 * 10. Relatório de Entrega da Campanha em Tempo Real (Proof of Play)
 */
export async function getCampaignDeliveryReportAction(campaignId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('id', campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  // Obter mídias vinculadas
  const { data: cMedia } = await (supabase.from('campaign_media') as any)
    .select('media_asset_id, media_assets(id, title)')
    .eq('campaign_id', campaignId);

  const mediaIds = (cMedia || []).map((m: any) => m.media_asset_id);

  // Obter telas vinculadas
  const { data: cScreens } = await (supabase.from('campaign_screens') as any)
    .select('screen_id, screens(id, name)')
    .eq('campaign_id', campaignId);

  const screenIds = (cScreens || []).map((s: any) => s.screen_id);

  if (mediaIds.length === 0 || screenIds.length === 0) {
    return {
      success: true,
      report: {
        totalCompleted: 0,
        totalFailed: 0,
        completionPercentage: 0,
        lastPlayedAt: null,
        mediaStats: [],
        screenStats: [],
      },
    };
  }

  // Buscar logs da tabela playback_logs
  let logsQuery = (supabase.from('playback_logs') as any)
    .select('id, media_asset_id, screen_id, status, played_at')
    .eq('company_id', campaign.company_id)
    .in('media_asset_id', mediaIds)
    .in('screen_id', screenIds);

  if (campaign.start_date) {
    logsQuery = logsQuery.gte('played_at', `${campaign.start_date}T00:00:00.000Z`);
  }

  if (campaign.end_date) {
    logsQuery = logsQuery.lte('played_at', `${campaign.end_date}T23:59:59.999Z`);
  }

  const { data: logs } = await logsQuery;

  const validLogs = logs || [];
  const completedLogs = validLogs.filter((l: any) => l.status === 'completed');
  const failedLogs = validLogs.filter((l: any) => l.status === 'failed');

  const totalCompleted = completedLogs.length;
  const totalFailed = failedLogs.length;

  let completionPercentage = 0;
  if (campaign.target_insertions && campaign.target_insertions > 0) {
    completionPercentage = Math.min(100, Math.round((totalCompleted / campaign.target_insertions) * 100));
  }

  // Encontrar último horário de exibição
  const lastPlayedAt = completedLogs.length > 0
    ? completedLogs.reduce((latest: string, curr: any) => (curr.played_at > latest ? curr.played_at : latest), completedLogs[0].played_at)
    : null;

  // Estatísticas por Mídia
  const mediaStats = (cMedia || []).map((m: any) => {
    const count = completedLogs.filter((l: any) => l.media_asset_id === m.media_asset_id).length;
    return {
      media_id: m.media_asset_id,
      title: m.media_assets?.title || 'Mídia',
      completed_count: count,
    };
  });

  // Estatísticas por Tela
  const screenStats = (cScreens || []).map((s: any) => {
    const count = completedLogs.filter((l: any) => l.screen_id === s.screen_id).length;
    return {
      screen_id: s.screen_id,
      name: s.screens?.name || 'Tela',
      completed_count: count,
    };
  });

  // Atualizar contagem entregue no banco
  await (supabase.from('campaigns') as any)
    .update({ delivered_insertions: totalCompleted })
    .eq('id', campaignId);

  return {
    success: true,
    report: {
      totalCompleted,
      totalFailed,
      completionPercentage,
      lastPlayedAt,
      mediaStats,
      screenStats,
    },
  };
}
