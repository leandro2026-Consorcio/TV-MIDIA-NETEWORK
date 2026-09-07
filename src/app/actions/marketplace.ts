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
