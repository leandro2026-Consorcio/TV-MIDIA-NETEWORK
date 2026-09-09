'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * 1. Listar Ofertas Ativas no Marketplace com Filtros
 */
export async function getMarketplaceOffersAction(filters?: {
  search?: string;
  companyId?: string;
  city?: string;
  segmentId?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
}) {
  const supabase = createClient();

  let query = (supabase.from('company_ad_offers') as any)
    .select('*, company:companies!company_ad_offers_company_id_fkey(*)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (filters?.companyId) {
    query = query.eq('company_id', filters.companyId);
  }

  if (filters?.minPriceCents) {
    query = query.gte('price_cents', filters.minPriceCents);
  }

  if (filters?.maxPriceCents) {
    query = query.lte('price_cents', filters.maxPriceCents);
  }

  const { data: rawOffers, error } = await query;

  if (error) {
    return { success: false, error: error.message, offers: [] };
  }

  let filteredOffers = rawOffers || [];

  // Filtrar apenas empresas que aceitam anúncios da rede
  const { data: networkPrefs } = await (supabase.from('company_network_preferences') as any)
    .select('company_id, accepts_network_ads');

  const disabledNetworkCompanyIds = new Set(
    (networkPrefs || [])
      .filter((p: any) => p.accepts_network_ads === false)
      .map((p: any) => p.company_id)
  );

  filteredOffers = filteredOffers.filter(
    (o: any) => !disabledNetworkCompanyIds.has(o.company_id)
  );

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    filteredOffers = filteredOffers.filter(
      (o: any) =>
        o.title.toLowerCase().includes(s) ||
        (o.description && o.description.toLowerCase().includes(s)) ||
        (o.company?.trade_name && o.company.trade_name.toLowerCase().includes(s))
    );
  }

  if (filters?.city) {
    const c = filters.city.toLowerCase();
    filteredOffers = filteredOffers.filter(
      (o: any) => o.company?.city && o.company.city.toLowerCase().includes(c)
    );
  }

  // Filtro por segmento da empresa exibidora
  if (filters?.segmentId) {
    const { data: compSegs } = await (supabase.from('company_segments') as any)
      .select('company_id')
      .eq('segment_id', filters.segmentId);

    if (compSegs) {
      const validCompanyIds = new Set(compSegs.map((cs: any) => cs.company_id));
      filteredOffers = filteredOffers.filter((o: any) => validCompanyIds.has(o.company_id));
    }
  }

  return { success: true, offers: filteredOffers };
}

/**
 * 2. Obter Detalhes da Oferta de Mídia no Marketplace
 */
export async function getMarketplaceOfferDetailsAction(offerId: string) {
  const supabase = createClient();
  const { data: offer, error } = await (supabase.from('company_ad_offers') as any)
    .select('*, company:companies(*)')
    .eq('id', offerId)
    .single();

  if (error || !offer) {
    return { success: false, error: 'Oferta de mídia não encontrada ou inativa.' };
  }

  // Buscar segmentos da empresa exibidora
  const { data: segments } = await (supabase.from('company_segments') as any)
    .select('*, segment:segments(*)')
    .eq('company_id', offer.company_id);

  return { success: true, offer, segments: segments || [] };
}

/**
 * 3. Buscar Mídias Aprovadas da Empresa Compradora (para vincular na solicitação)
 */
export async function getApprovedCompanyMediaAssetsAction(companyId: string) {
  const supabase = createClient();
  const { data: mediaAssets, error } = await (supabase.from('media_assets') as any)
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'approved')
    .eq('trial_internal_only', false)
    .eq('owner_only', false)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, mediaAssets: [] };
  }

  return { success: true, mediaAssets: mediaAssets || [] };
}

/**
 * 4. Criar Solicitação de Mídia no Marketplace (Invoca a RPC com trava de concorrentes e auto-compra)
 */
export async function createMarketplaceRequestAction(payload: {
  offer_id: string;
  buyer_company_id: string;
  request_message?: string;
  requested_start_date?: string;
  requested_end_date?: string;
  requested_media_asset_id?: string;
  notes?: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Verificação de Conformidade de Termos da Empresa Compradora
  const { data: complianceResult } = await (supabase.rpc as any)('check_company_required_terms', {
    p_company_id: payload.buyer_company_id,
  });

  if (complianceResult && complianceResult.compliant === false) {
    return {
      success: false,
      error: 'Existem termos comerciais pendentes de aceite para sua empresa antes de realizar solicitações no marketplace.',
    };
  }

  const { data: result, error } = await (supabase.rpc as any)('create_marketplace_media_request', {
    p_offer_id: payload.offer_id,
    p_buyer_company_id: payload.buyer_company_id,
    p_request_message: payload.request_message || null,
    p_requested_start_date: payload.requested_start_date || null,
    p_requested_end_date: payload.requested_end_date || null,
    p_requested_media_asset_id: payload.requested_media_asset_id || null,
    p_notes: payload.notes || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (result && !result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, result };
}

/**
 * 5. Listar Solicitações Enviadas pela Empresa Compradora
 */
export async function getSentMediaRequestsAction(companyId: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.from('ad_offer_orders') as any)
    .select('*, offer:company_ad_offers(*), seller:companies!ad_offer_orders_seller_company_id_fkey(*), media:media_assets!ad_offer_orders_requested_media_asset_id_fkey(*)')
    .eq('buyer_company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, requests: [] };
  }

  return { success: true, requests: data || [] };
}

/**
 * 6. Listar Solicitações Recebidas pela Empresa Exibidora / Vendedora
 */
export async function getReceivedMediaRequestsAction(companyId: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.from('ad_offer_orders') as any)
    .select('*, offer:company_ad_offers(*), buyer:companies!ad_offer_orders_buyer_company_id_fkey(*), media:media_assets!ad_offer_orders_requested_media_asset_id_fkey(*)')
    .eq('seller_company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, requests: [] };
  }

  return { success: true, requests: data || [] };
}

/**
 * 7. Aprovar Solicitação de Mídia (Empresa Exibidora ou Master Admin)
 */
export async function approveMediaRequestAction(orderId: string) {
  const supabase = createClient();
  const { data: result, error } = await (supabase.rpc as any)('approve_marketplace_media_request', {
    p_order_id: orderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (result && !result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * 8. Rejeitar Solicitação de Mídia com Motivo (Empresa Exibidora ou Master Admin)
 */
export async function rejectMediaRequestAction(orderId: string, rejectionReason: string) {
  const supabase = createClient();
  const { data: result, error } = await (supabase.rpc as any)('reject_marketplace_media_request', {
    p_order_id: orderId,
    p_rejection_reason: rejectionReason,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (result && !result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * 9. Cancelar Solicitação Pendente (Empresa Compradora)
 */
export async function cancelMediaRequestAction(orderId: string) {
  const supabase = createClient();
  const { data: result, error } = await (supabase.rpc as any)('cancel_marketplace_media_request', {
    p_order_id: orderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (result && !result.success) {
    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * 10. Obter Opções de Filtro (Cidades, Empresas e Segmentos) para o Marketplace
 */
export async function getMarketplaceFiltersDataAction() {
  const supabase = createClient();

  const { data: companies } = await (supabase.from('companies') as any)
    .select('id, trade_name, city')
    .order('trade_name', { ascending: true });

  const { data: segments } = await (supabase.from('segments') as any)
    .select('id, name')
    .order('name', { ascending: true });

  const cities = Array.from(
    new Set((companies || []).map((c: any) => c.city).filter((city: any) => !!city))
  ).sort() as string[];

  return {
    success: true,
    companies: companies || [],
    segments: segments || [],
    cities,
  };
}

/**
 * 11. Converter Pedido de Oferta em Campanha Comercial (Invoca a RPC convert_ad_offer_order_to_campaign)
 */
export async function convertAdOfferOrderToCampaignAction(orderId: string) {
  const supabase = createClient();
  const { data: result, error } = await (supabase.rpc as any)('convert_ad_offer_order_to_campaign', {
    p_order_id: orderId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (result && !result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, campaign_id: result.campaign_id };
}

/**
 * 12. Solicitar Veiculação de Campanha em Tela da Rede (Marketplace Omnichannel)
 * Preserva campanha de origem, empresa, datas e criativo sem exigir recriar a campanha do zero.
 */
export async function requestScreenDistributionAction(input: {
  screenId: string;
  campaignId: string;
  mediaAssetId?: string;
  message?: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // 1. Carregar Campanha
  const { data: campaign, error: campErr } = await (supabase.from('campaigns') as any)
    .select('*, company:companies(*)')
    .eq('id', input.campaignId)
    .single();

  if (campErr || !campaign) {
    return { success: false, error: 'Campanha não encontrada.' };
  }

  // 2. Carregar Tela e Empresa Dona da Tela
  const { data: screen, error: scrErr } = await (supabase.from('screens') as any)
    .select('*, company:companies(*)')
    .eq('id', input.screenId)
    .single();

  if (scrErr || !screen) {
    return { success: false, error: 'Tela não encontrada.' };
  }

  // Caso 1: A tela é da própria empresa da campanha -> Vincular diretamente à campanha
  if (screen.company_id === campaign.company_id) {
    const { error: linkErr } = await (supabase.from('campaign_screens') as any)
      .upsert({
        campaign_id: campaign.id,
        screen_id: screen.id,
        is_active: true,
      }, { onConflict: 'campaign_id,screen_id' });

    if (linkErr) {
      return { success: false, error: linkErr.message };
    }

    return {
      success: true,
      mode: 'internal' as const,
      message: `A tela "${screen.name}" pertence à sua própria empresa e foi vinculada diretamente à campanha!`,
    };
  }

  // Caso 2: Tela de empresa parceira na rede -> Solicitação cross-company via marketplace
  // Verificar se a parceira aceita anúncios da rede (campo canônico: accepts_network_ads)
  const { data: sellerPrefs } = await (supabase.from('company_network_preferences') as any)
    .select('accepts_network_ads, blocked_companies, blocked_segments')
    .eq('company_id', screen.company_id)
    .maybeSingle();

  if (sellerPrefs && sellerPrefs.accepts_network_ads === false) {
    return {
      success: false,
      error: 'A empresa proprietária desta TV optou por não receber anúncios da rede no momento.',
    };
  }

  // Resolver Mídia: usar a passada ou a primeira mídia aprovada da campanha
  let mediaId = input.mediaAssetId;
  if (!mediaId) {
    const { data: cMedia } = await (supabase.from('campaign_media') as any)
      .select('media_asset_id')
      .eq('campaign_id', campaign.id)
      .limit(1);
    mediaId = cMedia?.[0]?.media_asset_id;
  }

  if (!mediaId) {
    return {
      success: false,
      error: 'A campanha não possui nenhum criativo/mídia aprovado vinculado.',
    };
  }

  // Buscar oferta da empresa parceira ou criar um card padrão para o pedido
  let offerId: string | null = null;
  const { data: existingOffers } = await (supabase.from('company_ad_offers') as any)
    .select('id')
    .eq('company_id', screen.company_id)
    .eq('status', 'active')
    .limit(1);

  if (existingOffers && existingOffers.length > 0) {
    offerId = existingOffers[0].id;
  } else {
    // Criar oferta comercial padrão vinculada à tela para viabilizar a transação
    const { data: newOffer, error: offerErr } = await (supabase.from('company_ad_offers') as any)
      .insert({
        company_id: screen.company_id,
        title: `Inserções na TV: ${screen.name}`,
        description: `Exibição comercial na tela ${screen.name} localizada em ${screen.company?.city || 'ponto comercial'}.`,
        credits_amount: 100,
        price_cents: 5000,
        status: 'active',
        is_public: true,
      })
      .select('id')
      .single();

    if (!offerErr && newOffer) {
      offerId = newOffer.id;
    }
  }

  if (!offerId) {
    return {
      success: false,
      error: 'Não foi possível encontrar ou inicializar a oferta de mídia para esta tela parceira.',
    };
  }

  // Criar Pedido / Solicitação de Veiculação preservando dados da campanha
  const res = await createMarketplaceRequestAction({
    offer_id: offerId,
    buyer_company_id: campaign.company_id,
    request_message: input.message || `Distribuição da campanha: ${campaign.name}`,
    requested_start_date: campaign.start_date || undefined,
    requested_end_date: campaign.end_date || undefined,
    requested_media_asset_id: mediaId,
    notes: `Solicitação originada da campanha ID: ${campaign.id} para exibição na tela "${screen.name}" (${screen.id}).`,
  });

  if (!res.success) {
    return { success: false, error: res.error };
  }

  // Vincular campaign_id no ad_offer_orders recém-criado
  const orderId = res.result?.order_id || res.result?.id;
  if (orderId) {
    await (supabase.from('ad_offer_orders') as any)
      .update({ campaign_id: campaign.id })
      .eq('id', orderId);
  }

  return {
    success: true,
    mode: 'network_request' as const,
    message: `Solicitação de veiculação enviada com sucesso para "${screen.company?.trade_name || 'a empresa parceira'}"! Sua campanha "${campaign.name}" e criativo foram vinculados automaticamente sem exigir recriar a campanha do zero.`,
  };
}
