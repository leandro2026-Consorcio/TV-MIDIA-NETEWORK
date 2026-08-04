'use server';

import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export interface InformativeContentLogPayload {
  content_id: string;
  content_type: 'manual' | 'rss';
  started_at: string;
  ended_at: string;
  status: 'completed' | 'skipped' | 'failed';
  error_message?: string | null;
  idempotency_key: string;
  player_session_id?: string | null;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function recordInformativeContentLogAction(
  deviceToken: string,
  payload: InformativeContentLogPayload
) {
  if (!deviceToken?.startsWith('sk_device_') || deviceToken.length < 20) {
    return { success: false, error: 'Token de dispositivo inválido.' };
  }
  if (!payload.content_id || payload.idempotency_key.length < 16 || payload.idempotency_key.length > 200) {
    return { success: false, error: 'Conteúdo ou chave de idempotência ausente.' };
  }
  if (!['manual', 'rss'].includes(payload.content_type) || !['completed', 'skipped', 'failed'].includes(payload.status)) {
    return { success: false, error: 'Tipo ou status operacional inválido.' };
  }
  const startedAt = new Date(payload.started_at).getTime();
  const endedAt = new Date(payload.ended_at).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) {
    return { success: false, error: 'Período do log operacional inválido.' };
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return { success: false, error: 'Serviço de logs informativos indisponível.' };
  }

  const tokenHash = hashToken(deviceToken);
  const { data: screen } = await (supabase.from('screens') as any)
    .select('id, company_id, status')
    .eq('device_token_hash', tokenHash)
    .single();
  if (!screen || screen.status === 'inactive') return { success: false, error: 'Dispositivo inválido ou inativo.' };

  const { data: settings } = await (supabase.from('screen_content_settings') as any)
    .select('enable_breathing_content, enable_manual_content, enable_rss_content, is_active')
    .eq('screen_id', screen.id)
    .eq('company_id', screen.company_id)
    .maybeSingle();
  if (!settings?.is_active || !settings.enable_breathing_content) {
    return { success: false, error: 'Conteúdo informativo não está habilitado nesta tela.' };
  }
  if (payload.content_type === 'manual' && !settings.enable_manual_content) return { success: false, error: 'Conteúdo manual desabilitado.' };
  if (payload.content_type === 'rss' && !settings.enable_rss_content) return { success: false, error: 'Conteúdo RSS desabilitado.' };

  const { data: content } = await (supabase.from('informative_content_items') as any)
    .select('id, company_id, content_origin, status, is_active, expires_at')
    .eq('id', payload.content_id)
    .single();
  if (
    !content ||
    content.content_origin !== payload.content_type ||
    !content.is_active ||
    !['approved', 'active'].includes(content.status) ||
    (content.company_id && content.company_id !== screen.company_id) ||
    (content.expires_at && new Date(content.expires_at).getTime() <= Date.now())
  ) {
    return { success: false, error: 'Conteúdo informativo não pertence à programação válida da tela.' };
  }

  const { data, error } = await (supabase.from('screen_content_logs') as any)
    .insert({
      company_id: screen.company_id,
      screen_id: screen.id,
      content_type: payload.content_type,
      content_id: payload.content_id,
      started_at: payload.started_at,
      ended_at: payload.ended_at,
      status: payload.status,
      error_message: payload.error_message || null,
      idempotency_key: payload.idempotency_key,
      player_session_id: payload.player_session_id || null,
      metadata: { operational_only: true, commercial_proof_of_play: false },
    })
    .select('id')
    .single();

  if (error?.code === '23505') return { success: true, deduplicated: true, logId: null };
  if (error) return { success: false, error: error.message };
  return { success: true, deduplicated: false, logId: data?.id || null };
}
