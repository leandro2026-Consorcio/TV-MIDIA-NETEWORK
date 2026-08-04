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

function normalizeLocation(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function regionMatchesState(region: unknown, state: unknown): boolean {
  const normalizedRegion = normalizeLocation(region);
  const normalizedState = normalizeLocation(state);
  if (!normalizedRegion || normalizedRegion === normalizedState) return true;
  const macroRegions: Record<string, string[]> = {
    norte: ['ac', 'ap', 'am', 'pa', 'ro', 'rr', 'to'],
    nordeste: ['al', 'ba', 'ce', 'ma', 'pb', 'pe', 'pi', 'rn', 'se'],
    'centro-oeste': ['df', 'go', 'mt', 'ms'],
    centrooeste: ['df', 'go', 'mt', 'ms'],
    sudeste: ['es', 'mg', 'rj', 'sp'],
    sul: ['pr', 'rs', 'sc'],
  };
  return (macroRegions[normalizedRegion] || []).includes(normalizedState);
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b > 0) [a, b] = [b, a % b];
  return a || 1;
}

function leastCommonMultiple(left: number, right: number): number {
  return Math.abs(left * right) / greatestCommonDivisor(left, right);
}

function interleaveInformativeItems(
  commercialItems: PlayerPlaylistItem[],
  informativeItems: PlayerPlaylistItem[],
  mixMode: 'ads_first' | 'content_first',
  interval: number
): PlayerPlaylistItem[] {
  if (commercialItems.length === 0) return informativeItems;
  if (informativeItems.length === 0) return commercialItems;

  const validInterval = Math.min(5, Math.max(1, Number(interval) || 4));
  const result: PlayerPlaylistItem[] = [];

  if (mixMode === 'ads_first') {
    const totalSlots = leastCommonMultiple(
      commercialItems.length,
      validInterval * informativeItems.length
    );
    let contentIdx = 0;
    for (let slot = 0; slot < totalSlots; slot += 1) {
      const commercial = commercialItems[slot % commercialItems.length];
      result.push({ ...commercial, id: `${commercial.id}:slot:${slot}` });
      if ((slot + 1) % validInterval === 0) {
        const informative = informativeItems[contentIdx % informativeItems.length];
        result.push({ ...informative, id: `${informative.id}:slot:${contentIdx}` });
        contentIdx += 1;
      }
    }
  } else {
    const totalSlots = leastCommonMultiple(
      informativeItems.length,
      validInterval * commercialItems.length
    );
    let commercialIdx = 0;
    for (let slot = 0; slot < totalSlots; slot += 1) {
      const informative = informativeItems[slot % informativeItems.length];
      result.push({ ...informative, id: `${informative.id}:slot:${slot}` });
      if ((slot + 1) % validInterval === 0) {
        const commercial = commercialItems[commercialIdx % commercialItems.length];
        result.push({ ...commercial, id: `${commercial.id}:slot:${commercialIdx}` });
        commercialIdx += 1;
      }
    }
  }

  return result;
}

export interface PlayerPlaylistItem {
  id: string;
  item_type: 'commercial_campaign' | 'internal_campaign' | 'playlist_media' | 'informative_manual' | 'informative_rss';
  playlist_id: string | null;
  playlist_item_id: string | null;
  campaign_id: string | null;
  content_id: string | null;
  media_id: string | null;
  title: string;
  media_type: 'image' | 'video' | 'informative';
  orientation: 'horizontal' | 'vertical' | 'square' | 'unknown';
  signed_url: string | null;
  playback_duration_seconds: number;
  sort_order: number;
  content_origin?: 'manual' | 'rss';
  summary?: string | null;
  category?: string | null;
  source_name?: string | null;
  original_url?: string | null;
  published_at?: string | null;
  image_url?: string | null;
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
    .select('id, company_id, name, orientation, resolution, status, companies(city, state)')
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
    item_type: 'commercial_campaign' | 'internal_campaign' | 'playlist_media';
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
          item_type: 'playlist_media',
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
      .select('id, company_id, seller_company_id, campaign_type, start_date, end_date, status')
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
          item_type: (campaigns || []).find((campaign: any) => campaign.id === item.campaign_id)?.campaign_type === 'internal'
            ? 'internal_campaign'
            : 'commercial_campaign',
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
        item_type: item.item_type,
        playlist_id: item.playlist_id,
        playlist_item_id: item.playlist_item_id,
        campaign_id: item.campaign_id,
        content_id: null,
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

  // 7. Conteúdo informativo é uma camada operacional opcional. Ele só é
  // intercalado quando já existe programação comercial válida.
  const { data: contentSettings } = await (supabase.from('screen_content_settings') as any)
    .select('*')
    .eq('screen_id', screen.id)
    .eq('company_id', screen.company_id)
    .eq('is_active', true)
    .maybeSingle();

  let finalItems = itemsWithSignedUrls;
  if (contentSettings?.enable_breathing_content && itemsWithSignedUrls.length > 0) {
    const { data: informativeItems } = await (supabase.from('informative_content_items') as any)
      .select('id, company_id, content_source_id, content_origin, title, summary, category, image_url, media_asset_id, source_name, original_url, published_at, region, city, duration_seconds, start_date, end_date, status, is_active, expires_at, content_sources(is_active), media_assets(id, file_path, media_type, status)')
      .or(`company_id.is.null,company_id.eq.${screen.company_id}`)
      .eq('is_active', true)
      .in('status', ['approved', 'active'])
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(50);

    const today = currentBusinessDate();
    const nowMs = Date.now();
    const allowedCategories = (contentSettings.allowed_categories || []).map(normalizeLocation);
    const company = screen.companies as any;
    const screenCity = normalizeLocation(company?.city);
    const screenRegion = normalizeLocation(company?.state);
    const eligible = (informativeItems || []).filter((item: any) => {
      if (item.content_origin === 'manual' && !contentSettings.enable_manual_content) return false;
      if (item.content_origin === 'rss' && !contentSettings.enable_rss_content) return false;
      const contentSource = Array.isArray(item.content_sources)
        ? item.content_sources[0]
        : item.content_sources;
      if (item.content_origin === 'rss' && contentSource?.is_active !== true) return false;
      if (item.start_date && item.start_date > today) return false;
      if (item.end_date && item.end_date < today) return false;
      if (item.expires_at && new Date(item.expires_at).getTime() <= nowMs) return false;
      if (allowedCategories.length > 0 && !allowedCategories.includes(normalizeLocation(item.category))) return false;
      if (item.city && normalizeLocation(item.city) !== screenCity) return false;
      if (item.region && !regionMatchesState(item.region, screenRegion)) return false;
      return true;
    });

    const operationalItems: PlayerPlaylistItem[] = [];
    for (const item of eligible) {
      let imageUrl = item.image_url || null;
      const mediaAsset = item.media_assets as any;
      if (mediaAsset?.status === 'approved' && mediaAsset.media_type === 'image' && mediaAsset.file_path) {
        const { data: signedImage } = await supabase.storage.from('media-assets').createSignedUrl(mediaAsset.file_path, 3600);
        if (signedImage?.signedUrl) imageUrl = signedImage.signedUrl;
      }
      operationalItems.push({
        id: `informative:${item.id}`,
        item_type: item.content_origin === 'rss' ? 'informative_rss' : 'informative_manual',
        playlist_id: null,
        playlist_item_id: null,
        campaign_id: null,
        content_id: item.id,
        media_id: null,
        title: item.title,
        media_type: 'informative',
        orientation: 'horizontal',
        signed_url: null,
        playback_duration_seconds: Math.min(15, Math.max(8, Number(contentSettings.content_duration_seconds || item.duration_seconds || 10))),
        sort_order: 0,
        content_origin: item.content_origin,
        summary: item.summary,
        category: item.category,
        source_name: item.source_name,
        original_url: item.original_url,
        published_at: item.published_at,
        image_url: imageUrl,
      });
    }

    if (operationalItems.length > 0) {
      const mixMode = contentSettings.content_mix_mode === 'content_first' ? 'content_first' : 'ads_first';
      const interval = Math.min(5, Math.max(1, Number(contentSettings.mix_interval || contentSettings.ads_between_content || 4)));
      finalItems = interleaveInformativeItems(itemsWithSignedUrls, operationalItems, mixMode, interval);
    }
  }

  return {
    success: true,
    // Mantém compatibilidade com o player: campanha ativa também é uma programação válida.
    hasPlaylist: true,
    hasItems: finalItems.length > 0,
    message: finalItems.length > 0 ? 'Programação carregada' : 'Não foi possível assinar as URLs das mídias.',
    screen: screenInfo,
    playlist: playlist ? { id: playlist.id, name: playlist.name, orientation: playlist.orientation } : null,
    items: finalItems,
  };
}
