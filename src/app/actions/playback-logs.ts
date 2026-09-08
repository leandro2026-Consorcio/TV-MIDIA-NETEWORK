'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function currentBusinessDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export interface PlaybackLogIngestPayload {
  media_asset_id: string;
  playlist_id?: string | null;
  playlist_item_id?: string | null;
  media_type: 'image' | 'video';
  planned_duration_seconds: number;
  actual_duration_seconds?: number | null;
  started_at: string;
  ended_at?: string | null;
  status: 'started' | 'completed' | 'skipped' | 'failed';
  failure_reason?: string | null;
  idempotency_key: string;
  player_session_id?: string | null;
}

/**
 * SERVER ACTION DE INGEST DE LOGS DO PLAYER (USANDO RPC SECURITY DEFINER):
 * 1. O cliente (player anônimo) envia APENAS o deviceToken e o payload do evento.
 * 2. NENHUMA chave service_role é exposta no frontend.
 * 3. O servidor gera o hash SHA-256 do token e delega o ingest para a RPC 'record_playback_log'.
 * 4. A RPC valida no banco: Token, Dispositivo, Empresa, Mídia Aprovada, Playlist Ativa da TV, Item e Idempotência.
 */
export async function recordPlaybackLogAction(
  deviceToken: string,
  payload: PlaybackLogIngestPayload
) {
  if (!deviceToken || typeof deviceToken !== 'string' || deviceToken.trim().length < 20 || !deviceToken.startsWith('sk_device_')) {
    return { success: false, error: 'Token de dispositivo inválido ou malformado.' };
  }

  if (!payload.idempotency_key || payload.idempotency_key.trim().length === 0) {
    return { success: false, error: 'Chave de idempotência (idempotency_key) não fornecida.' };
  }

  if (!payload.media_asset_id) {
    return { success: false, error: 'ID da mídia não fornecido.' };
  }

  if (payload.planned_duration_seconds < 5 || payload.planned_duration_seconds > 3600 || payload.planned_duration_seconds % 5 !== 0) {
    return { success: false, error: 'Duração planejada inválida.' };
  }

  if (!['started', 'completed', 'skipped', 'failed'].includes(payload.status)) {
    return { success: false, error: 'Status de exibição inválido.' };
  }

  if (payload.actual_duration_seconds != null && payload.actual_duration_seconds < 0) {
    return { success: false, error: 'Duração real inválida.' };
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error('Erro de configuração ao registrar exibição:', error);
    return { success: false, error: 'Serviço de registro de exibição indisponível.' };
  }

  const tokenHash = hashToken(deviceToken);

  const { data: screen } = await (supabase.from('screens') as any)
    .select('id, company_id, status')
    .eq('device_token_hash', tokenHash)
    .single();

  if (!screen || screen.status === 'inactive') {
    return { success: false, error: 'Dispositivo inválido, inativo ou pareamento revogado.' };
  }

  const { data: media } = await (supabase.from('media_assets') as any)
    .select('id, company_id, status, media_type')
    .eq('id', payload.media_asset_id)
    .single();

  if (!media || media.status !== 'approved' || media.media_type !== payload.media_type) {
    return { success: false, error: 'Mídia inválida, não aprovada ou com tipo divergente.' };
  }

  let sourceIsValid = false;

  // Fonte 1: item pertencente à playlist atualmente vinculada à tela.
  if (payload.playlist_id) {
    const { data: activePlaylist } = await (supabase.from('screen_playlists') as any)
      .select('playlist_id, playlists(company_id, status)')
      .eq('screen_id', screen.id)
      .eq('playlist_id', payload.playlist_id)
      .eq('is_active', true)
      .single();

    if (
      activePlaylist &&
      activePlaylist.playlists?.status === 'active' &&
      activePlaylist.playlists?.company_id === screen.company_id
    ) {
      let itemQuery = (supabase.from('playlist_items') as any)
        .select('id')
        .eq('playlist_id', payload.playlist_id)
        .eq('media_asset_id', payload.media_asset_id)
        .eq('playback_duration_seconds', payload.planned_duration_seconds)
        .eq('is_active', true);

      if (payload.playlist_item_id) {
        itemQuery = itemQuery.eq('id', payload.playlist_item_id);
      }

      const { data: playlistItem } = await itemQuery.limit(1).maybeSingle();
      sourceIsValid = !!playlistItem && media.company_id === screen.company_id;
    }
  }

  // Fonte 2: mídia de uma campanha ativa e programada para esta tela.
  if (!sourceIsValid && !payload.playlist_id && !payload.playlist_item_id) {
    const { data: screenCampaigns } = await (supabase.from('campaign_screens') as any)
      .select('campaign_id')
      .eq('screen_id', screen.id)
      .eq('is_active', true);

    const campaignIds = (screenCampaigns || []).map((link: any) => link.campaign_id);
    if (campaignIds.length > 0) {
      const today = currentBusinessDate();
      const { data: campaigns } = await (supabase.from('campaigns') as any)
        .select('id, company_id, seller_company_id, status, start_date, end_date')
        .in('id', campaignIds)
        .eq('status', 'active');

      const scheduledCampaignIds = (campaigns || [])
        .filter((campaign: any) =>
          (!campaign.start_date || campaign.start_date <= today) &&
          (!campaign.end_date || campaign.end_date >= today) &&
          (campaign.company_id === screen.company_id || campaign.seller_company_id === screen.company_id)
        )
        .map((campaign: any) => campaign.id);

      if (scheduledCampaignIds.length > 0) {
        const { data: campaignMedia } = await (supabase.from('campaign_media') as any)
          .select('id')
          .in('campaign_id', scheduledCampaignIds)
          .eq('media_asset_id', payload.media_asset_id)
          .eq('playback_duration_seconds', payload.planned_duration_seconds)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        sourceIsValid = !!campaignMedia;
      }
    }
  }

  if (!sourceIsValid) {
    return { success: false, error: 'A mídia não pertence à programação ativa desta TV.' };
  }

  const failureReason = payload.status === 'failed'
    ? payload.failure_reason || 'Erro indeterminado de reprodução ou mídia corrompida'
    : payload.failure_reason || null;

  // A regra final vive no banco para que service_role não se torne um bypass
  // irrestrito de campanhas cross-company. A RPC revalida playlist/campanha,
  // pedido pago/aprovado, anunciante, mídia, exibidora e idempotência.
  const { data: inserted, error } = await (supabase.rpc as any)('record_playback_log', {
    p_device_token_hash: tokenHash,
    p_media_asset_id: payload.media_asset_id,
    p_playlist_id: payload.playlist_id || null,
    p_playlist_item_id: payload.playlist_item_id || null,
    p_media_type: payload.media_type,
    p_planned_duration_seconds: payload.planned_duration_seconds,
    p_actual_duration_seconds: payload.actual_duration_seconds ?? null,
    p_started_at: payload.started_at,
    p_ended_at: payload.ended_at || null,
    p_status: payload.status,
    p_failure_reason: failureReason,
    p_idempotency_key: payload.idempotency_key,
    p_player_session_id: payload.player_session_id || null,
  });

  if (error) {
    if (error.code === '23505') {
      return { success: true, deduplicated: true, logId: null, message: 'Exibição já registrada.' };
    }
    return { success: false, error: error.message };
  }

  return {
    success: true,
    deduplicated: Boolean(inserted?.deduplicated),
    logId: inserted?.playback_log_id || null,
    message: null,
  };
}
