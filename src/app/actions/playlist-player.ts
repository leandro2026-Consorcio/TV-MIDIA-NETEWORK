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

export interface PlayerPlaylistItem {
  id: string;
  playlist_id: string | null;
  playlist_item_id: string | null;
  campaign_id: string | null;
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
 * Valida o device_token, combina a playlist ativa com campanhas programadas
 * para a TV e gera Signed URLs de 60 min para o Storage privado.
 */
export async function getPlayerPlaylistAction(deviceToken: string) {
  if (!deviceToken || typeof deviceToken !== 'string' || deviceToken.trim().length < 20 || !deviceToken.startsWith('sk_device_')) {
    return { success: false, error: 'Token de dispositivo inválido ou malformado.' };
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error('Erro de configuração ao carregar playlist do player:', error);
    return { success: false, error: 'Serviço do player indisponível.' };
  }
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

  // 3. Buscar a playlist ativa vinculada à TV (a TV também pode operar somente com campanhas).
  const { data: screenLink } = await (supabase.from('screen_playlists') as any)
    .select('playlist_id, playlists(id, company_id, name, orientation, status)')
    .eq('screen_id', screen.id)
    .eq('is_active', true)
    .maybeSingle();

  const linkedPlaylist = screenLink?.playlists as any;
  const playlist = linkedPlaylist &&
    linkedPlaylist.company_id === screen.company_id &&
    linkedPlaylist.status === 'active'
    ? linkedPlaylist
    : null;

  const scheduledItems: Array<{
    id: string;
    playlist_id: string | null;
    playlist_item_id: string | null;
    campaign_id: string | null;
    sort_order: number;
    playback_duration_seconds: 5 | 10 | 15 | 30;
    media: any;
  }> = [];

  // 4. Itens da playlist base.
  if (playlist) {
    const { data: rawItems } = await (supabase.from('playlist_items') as any)
      .select('id, sort_order, playback_duration_seconds, media_assets(id, company_id, title, media_type, orientation, file_path, status)')
      .eq('playlist_id', playlist.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    for (const item of rawItems || []) {
      const media = item.media_assets;
      if (media?.status === 'approved' && media.company_id === screen.company_id) {
        scheduledItems.push({
          id: `playlist:${item.id}`,
          playlist_id: playlist.id,
          playlist_item_id: item.id,
          campaign_id: null,
          sort_order: item.sort_order,
          playback_duration_seconds: item.playback_duration_seconds,
          media,
        });
      }
    }
  }

  // 5. Mídias de campanhas ativas, dentro do período e vinculadas à TV.
  const { data: campaignScreenLinks } = await (supabase.from('campaign_screens') as any)
    .select('campaign_id')
    .eq('screen_id', screen.id)
    .eq('is_active', true);

  const campaignIds = (campaignScreenLinks || []).map((link: any) => link.campaign_id);
  if (campaignIds.length > 0) {
    const today = currentBusinessDate();
    const { data: campaigns } = await (supabase.from('campaigns') as any)
      .select('id, company_id, seller_company_id, start_date, end_date, status')
      .in('id', campaignIds)
      .eq('status', 'active');

    const activeCampaignIds = (campaigns || [])
      .filter((campaign: any) =>
        (!campaign.start_date || campaign.start_date <= today) &&
        (!campaign.end_date || campaign.end_date >= today) &&
        (campaign.company_id === screen.company_id || campaign.seller_company_id === screen.company_id)
      )
      .map((campaign: any) => campaign.id);

    if (activeCampaignIds.length > 0) {
      const { data: campaignItems } = await (supabase.from('campaign_media') as any)
        .select('id, campaign_id, playback_duration_seconds, media_assets(id, company_id, title, media_type, orientation, file_path, status)')
        .in('campaign_id', activeCampaignIds)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      for (const item of campaignItems || []) {
        const media = item.media_assets;
        if (media?.status === 'approved') {
          scheduledItems.push({
            id: `campaign:${item.id}`,
            playlist_id: null,
            playlist_item_id: null,
            campaign_id: item.campaign_id,
            sort_order: scheduledItems.length + 1,
            playback_duration_seconds: item.playback_duration_seconds,
            media,
          });
        }
      }
    }
  }

  const screenInfo = {
    id: screen.id,
    name: screen.name,
    orientation: screen.orientation,
    resolution: screen.resolution,
  };

  if (scheduledItems.length === 0) {
    return {
      success: true,
      hasPlaylist: !!playlist,
      hasItems: false,
      message: playlist
        ? 'Playlist ativa sem mídias aprovadas e nenhuma campanha ativa para esta TV.'
        : 'TV vinculada. Aguardando uma playlist ativa ou campanha ativa programada para esta tela.',
      screen: screenInfo,
      playlist: playlist ? { id: playlist.id, name: playlist.name, orientation: playlist.orientation } : null,
    };
  }

  // 6. Gerar Signed URLs temporárias de 60 minutos (3600s).
  const itemsWithSignedUrls: PlayerPlaylistItem[] = [];

  for (const item of scheduledItems) {
    const media = item.media;
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('media-assets')
      .createSignedUrl(media.file_path, 3600);

    if (!signedErr && signedData?.signedUrl) {
      itemsWithSignedUrls.push({
        id: item.id,
        playlist_id: item.playlist_id,
        playlist_item_id: item.playlist_item_id,
        campaign_id: item.campaign_id,
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
    // Mantém compatibilidade com o player: campanha ativa também é uma programação válida.
    hasPlaylist: true,
    hasItems: itemsWithSignedUrls.length > 0,
    message: itemsWithSignedUrls.length > 0 ? 'Programação carregada' : 'Não foi possível assinar as URLs das mídias.',
    screen: screenInfo,
    playlist: playlist ? { id: playlist.id, name: playlist.name, orientation: playlist.orientation } : null,
    items: itemsWithSignedUrls,
  };
}
