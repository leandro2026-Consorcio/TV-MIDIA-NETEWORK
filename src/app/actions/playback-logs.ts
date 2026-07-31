'use server';

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
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

  const supabase = createClient();
  const tokenHash = hashToken(deviceToken);

  // Invocar a RPC segura 'record_playback_log' executando com SECURITY DEFINER no banco
  const { data: result, error } = await (supabase.rpc as any)('record_playback_log', {
    p_device_token_hash: tokenHash,
    p_media_asset_id: payload.media_asset_id,
    p_playlist_id: payload.playlist_id || null,
    p_playlist_item_id: payload.playlist_item_id || null,
    p_media_type: payload.media_type,
    p_planned_duration_seconds: payload.planned_duration_seconds,
    p_actual_duration_seconds: payload.actual_duration_seconds || null,
    p_started_at: payload.started_at,
    p_ended_at: payload.ended_at || null,
    p_status: payload.status,
    p_failure_reason: payload.failure_reason || null,
    p_idempotency_key: payload.idempotency_key,
    p_player_session_id: payload.player_session_id || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!result || typeof result !== 'object') {
    return { success: false, error: 'Resposta inválida do servidor.' };
  }

  if (result.error) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    deduplicated: !!result.deduplicated,
    logId: result.log_id || null,
    message: result.message || null,
  };
}
