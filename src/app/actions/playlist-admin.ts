'use server';

import { createClient } from '@/lib/supabase/server';

export interface CreatePlaylistPayload {
  company_id: string;
  name: string;
  description?: string | null;
  orientation: 'horizontal' | 'vertical' | 'mixed';
}

/**
 * 1. Criar Playlist
 */
export async function createPlaylistAction(payload: CreatePlaylistPayload) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

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

  const { data: newPlaylist, error } = await (supabase.from('playlists') as any)
    .insert({
      company_id: payload.company_id,
      name: payload.name,
      description: payload.description || null,
      orientation: payload.orientation,
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !newPlaylist) {
    return { success: false, error: error?.message || 'Erro ao criar playlist.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: payload.company_id,
    action: 'PLAYLIST_CREATED',
    details: { playlist_id: newPlaylist.id, name: payload.name },
  });

  return { success: true, playlist: newPlaylist };
}

/**
 * 2. Atualizar Dados/Status da Playlist
 */
export async function updatePlaylistAction(
  playlistId: string,
  payload: {
    name?: string;
    description?: string | null;
    orientation?: 'horizontal' | 'vertical' | 'mixed';
    status?: 'draft' | 'active' | 'inactive' | 'archived';
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: playlist } = await (supabase.from('playlists') as any)
    .select('*')
    .eq('id', playlistId)
    .single();

  if (!playlist) {
    return { success: false, error: 'Playlist não encontrada.' };
  }

  const { error } = await (supabase.from('playlists') as any)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playlistId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: playlist.company_id,
    action: 'PLAYLIST_UPDATED',
    details: { playlist_id: playlistId, changes: payload },
  });

  return { success: true };
}

/**
 * 3. Adicionar Mídia Aprovada à Playlist
 */
export async function addPlaylistItemAction(
  playlistId: string,
  mediaAssetId: string,
  playbackDurationSeconds: 5 | 10 | 15 | 30
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: playlist } = await (supabase.from('playlists') as any)
    .select('*')
    .eq('id', playlistId)
    .single();

  if (!playlist) {
    return { success: false, error: 'Playlist não encontrada.' };
  }

  // Obter maior sort_order atual
  const { data: items } = await (supabase.from('playlist_items') as any)
    .select('sort_order')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = items && items.length > 0 ? items[0].sort_order + 1 : 1;

  // Tenta inserir (O Trigger trg_check_playlist_item_integrity no banco rejeitará caso mídias não sejam aprovadas ou pertençam a outra empresa)
  const { data: newItem, error } = await (supabase.from('playlist_items') as any)
    .insert({
      playlist_id: playlistId,
      media_asset_id: mediaAssetId,
      sort_order: nextOrder,
      playback_duration_seconds: playbackDurationSeconds,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: playlist.company_id,
    action: 'PLAYLIST_ITEM_ADDED',
    details: { playlist_id: playlistId, media_id: mediaAssetId },
  });

  return { success: true, item: newItem };
}

/**
 * 4. Remover Item da Playlist
 */
export async function removePlaylistItemAction(itemId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: item } = await (supabase.from('playlist_items') as any)
    .select('*, playlists(company_id)')
    .eq('id', itemId)
    .single();

  if (!item) {
    return { success: false, error: 'Item não encontrado.' };
  }

  const { error } = await (supabase.from('playlist_items') as any)
    .delete()
    .eq('id', itemId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: item.playlists?.company_id,
    action: 'PLAYLIST_ITEM_REMOVED',
    details: { item_id: itemId, playlist_id: item.playlist_id },
  });

  return { success: true };
}

/**
 * 5. Reordenar Itens da Playlist
 */
export async function reorderPlaylistItemsAction(
  playlistId: string,
  itemsOrder: { id: string; sort_order: number }[]
) {
  const supabase = createClient();

  for (const item of itemsOrder) {
    await (supabase.from('playlist_items') as any)
      .update({ sort_order: item.sort_order })
      .eq('id', item.id);
  }

  return { success: true };
}

/**
 * 6. Atribuir Playlist a uma Tela via RPC Atômica (assign_playlist_to_screen)
 */
export async function assignPlaylistToScreenAction(screenId: string, playlistId: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('assign_playlist_to_screen', {
    p_screen_id: screenId,
    p_playlist_id: playlistId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 7. Desvincular Playlist de uma Tela (TV)
 */
export async function unassignPlaylistFromScreenAction(screenId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: screen } = await (supabase.from('screens') as any)
    .select('*')
    .eq('id', screenId)
    .single();

  if (!screen) {
    return { success: false, error: 'Tela não encontrada.' };
  }

  await (supabase.from('screen_playlists') as any)
    .update({ is_active: false })
    .eq('screen_id', screenId);

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: screen.company_id,
    action: 'SCREEN_PLAYLIST_UNASSIGNED',
    details: { screen_id: screenId },
  });

  return { success: true };
}
