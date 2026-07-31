'use server';

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface PlayerPlaylistItem {
  id: string;
  media_id: string;
  title: string;
  media_type: 'image' | 'video';
  orientation: 'horizontal' | 'vertical' | 'square' | 'unknown';
  signed_url: string;
  playback_duration_seconds: 5 | 10 | 15 | 30;
  sort_order: number;
}

/**
 * SERVER ACTION EXCLUSIVA DO PLAYER:
 * Valida o device_token (Hash SHA-256), localiza a playlist ativa da TV e gera Signed URLs de 60 min para os arquivos do Storage Privado.
 */
export async function getPlayerPlaylistAction(deviceToken: string) {
  if (!deviceToken || typeof deviceToken !== 'string' || deviceToken.trim().length < 20 || !deviceToken.startsWith('sk_device_')) {
    return { success: false, error: 'Token de dispositivo inválido ou malformado.' };
  }

  const supabase = createClient();
  const tokenHash = hashToken(deviceToken);
  const now = new Date().toISOString();

  // 1. Localizar a TV pareada pelo Hash SHA-256
  const { data: screen, error: screenErr } = await (supabase.from('screens') as any)
    .select('id, company_id, name, orientation, resolution, status')
    .eq('device_token_hash', tokenHash)
    .single();

  if (screenErr || !screen) {
    return { success: false, error: 'Dispositivo não encontrado ou pareamento revogado.' };
  }

  if (screen.status === 'inactive') {
    return { success: false, error: 'Esta TV foi desativada pelo administrador.' };
  }

  // 2. Atualizar heartbeat ping
  await (supabase.from('screens') as any)
    .update({ last_ping_at: now, status: 'online', updated_at: now })
    .eq('id', screen.id);

  // 3. Buscar vínculo de playlist ativa da TV em screen_playlists
  const { data: screenLink } = await (supabase.from('screen_playlists') as any)
    .select('playlist_id, playlists(id, company_id, name, orientation, status)')
    .eq('screen_id', screen.id)
    .eq('is_active', true)
    .single();

  if (!screenLink || !screenLink.playlists) {
    return {
      success: true,
      hasPlaylist: false,
      message: 'TV vinculada com sucesso. Aguardando playlist.',
      screen: {
        id: screen.id,
        name: screen.name,
        orientation: screen.orientation,
        resolution: screen.resolution,
      },
    };
  }

  const playlist = screenLink.playlists;

  // Validar se a playlist pertence à mesma empresa da TV
  if (playlist.company_id !== screen.company_id || playlist.status === 'archived' || playlist.status === 'inactive') {
    return {
      success: true,
      hasPlaylist: false,
      message: 'A playlist vinculada está inativa ou arquivada.',
      screen: {
        id: screen.id,
        name: screen.name,
        orientation: screen.orientation,
        resolution: screen.resolution,
      },
    };
  }

  // 4. Buscar itens ativos da playlist com mídias obrigatoriamente APROVADAS
  const { data: rawItems } = await (supabase.from('playlist_items') as any)
    .select('id, sort_order, playback_duration_seconds, media_assets(id, company_id, title, media_type, orientation, file_path, status)')
    .eq('playlist_id', playlist.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const validItems = (rawItems || []).filter(
    (item: any) =>
      item.media_assets &&
      item.media_assets.status === 'approved' &&
      item.media_assets.company_id === screen.company_id
  );

  if (validItems.length === 0) {
    return {
      success: true,
      hasPlaylist: true,
      hasItems: false,
      message: 'Playlist ativa sem mídias aprovadas.',
      screen: {
        id: screen.id,
        name: screen.name,
        orientation: screen.orientation,
        resolution: screen.resolution,
      },
      playlist: {
        id: playlist.id,
        name: playlist.name,
        orientation: playlist.orientation,
      },
    };
  }

  // 5. Gerar Signed URLs temporárias de 60 minutos (3600s) para o bucket privado 'media-assets'
  const itemsWithSignedUrls: PlayerPlaylistItem[] = [];

  for (const item of validItems) {
    const media = item.media_assets;
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('media-assets')
      .createSignedUrl(media.file_path, 3600); // 60 minutos

    if (!signedErr && signedData?.signedUrl) {
      itemsWithSignedUrls.push({
        id: item.id,
        media_id: media.id,
        title: media.title,
        media_type: media.media_type,
        orientation: media.orientation,
        signed_url: signedData.signedUrl,
        playback_duration_seconds: item.playback_duration_seconds,
        sort_order: item.sort_order,
      });
    }
  }

  return {
    success: true,
    hasPlaylist: true,
    hasItems: itemsWithSignedUrls.length > 0,
    message: itemsWithSignedUrls.length > 0 ? 'Playlist carregada' : 'Não foi possível assinar as URLs das mídias.',
    screen: {
      id: screen.id,
      name: screen.name,
      orientation: screen.orientation,
      resolution: screen.resolution,
    },
    playlist: {
      id: playlist.id,
      name: playlist.name,
      orientation: playlist.orientation,
    },
    items: itemsWithSignedUrls,
  };
}
