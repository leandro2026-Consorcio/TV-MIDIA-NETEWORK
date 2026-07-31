'use server';

import { createClient } from '@/lib/supabase/server';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
];

const ALLOWED_PLAYBACK_DURATIONS = [5, 10, 15, 30];

export interface CreateMediaPayload {
  id?: string;
  company_id: string;
  title: string;
  description?: string | null;
  file_path: string;
  file_url?: string | null;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  media_type: 'image' | 'video';
  orientation: 'horizontal' | 'vertical' | 'square' | 'unknown';
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  playback_duration_seconds: 5 | 10 | 15 | 30;
}

/**
 * SERVER ACTION: Criar Mídia com Validação Server-Side Estrita
 */
export async function createMediaAssetAction(payload: CreateMediaPayload) {
  const supabase = createClient();

  // 1. Validar usuário autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // 2. Validação Server-Side de Empresa e Vínculo
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  const isMaster = !!profile?.is_master_admin;

  let userRole = 'operator';
  if (!isMaster) {
    const { data: userLink } = await (supabase.from('company_users') as any)
      .select('role')
      .eq('company_id', payload.company_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!userLink) {
      return { success: false, error: 'Acesso negado: Você não possui vínculo com a empresa informada.' };
    }
    userRole = userLink.role;
  }

  // 3. Validação Server-Side de Caminho do Arquivo no Storage
  if (!payload.file_path.startsWith(`${payload.company_id}/`)) {
    return { success: false, error: 'Violação de segurança: O arquivo no Storage deve estar na pasta do tenant correto.' };
  }

  // 4. Validação Server-Side de MIME Type
  if (!ALLOWED_MIME_TYPES.includes(payload.mime_type.toLowerCase())) {
    return { success: false, error: `MIME type não suportado: ${payload.mime_type}` };
  }

  // 5. Validação Server-Side de Duração de Exibição
  if (!ALLOWED_PLAYBACK_DURATIONS.includes(payload.playback_duration_seconds)) {
    return { success: false, error: 'Duração de exibição inválida. Escolha 5, 10, 15 ou 30 segundos.' };
  }

  // 6. Definir Status Inicial (Admin/Master = approved, Operador = pending_review)
  const initialStatus = isMaster || userRole === 'admin' ? 'approved' : 'pending_review';

  // 7. Inserir no banco
  const { data: newMedia, error: dbErr } = await (supabase.from('media_assets') as any)
    .insert({
      id: payload.id || undefined,
      company_id: payload.company_id,
      uploaded_by: user.id,
      title: payload.title,
      description: payload.description || null,
      file_path: payload.file_path,
      file_url: payload.file_url || null,
      file_name: payload.file_name,
      file_size_bytes: payload.file_size_bytes,
      mime_type: payload.mime_type,
      media_type: payload.media_type,
      orientation: payload.orientation,
      width: payload.width || null,
      height: payload.height || null,
      duration_seconds: payload.duration_seconds || null,
      playback_duration_seconds: payload.playback_duration_seconds,
      status: initialStatus,
    })
    .select()
    .single();

  if (dbErr || !newMedia) {
    return { success: false, error: dbErr?.message || 'Erro ao registrar metadados da mídia.' };
  }

  // 8. Log de Auditoria
  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: payload.company_id,
    action: 'MEDIA_UPLOADED',
    details: {
      media_id: newMedia.id,
      title: payload.title,
      status: initialStatus,
    },
  });

  return { success: true, media: newMedia };
}

/**
 * SERVER ACTION: Aprovar Mídia via RPC Segura
 */
export async function approveMediaAction(mediaId: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('approve_media_asset', {
    p_media_id: mediaId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * SERVER ACTION: Reprovar Mídia via RPC Segura
 */
export async function rejectMediaAction(mediaId: string, reason: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('reject_media_asset', {
    p_media_id: mediaId,
    p_reason: reason,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * SERVER ACTION: Arquivar Mídia via RPC Segura
 */
export async function archiveMediaAction(mediaId: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('archive_media_asset', {
    p_media_id: mediaId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
