'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * 1. Converter Pedido Aprovado e Pago em Campanha Comercial (Admin da Exibidora ou Master Admin)
 */
export async function convertAdOfferOrderToCampaignAction(orderId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: result, error } = await (supabase.rpc as any)('convert_ad_offer_order_to_campaign', {
    p_order_id: orderId,
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
 * 2. Processar Entregas da Campanha Comercial por Proof of Play (Playback Logs Completed)
 */
export async function processCommercialCampaignDeliveryAction(campaignId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: result, error } = await (supabase.rpc as any)('process_commercial_campaign_delivery', {
    p_campaign_id: campaignId,
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
 * 3. Obter Detalhes da Campanha Comercial, Livro de Entregas e Telas Vinculadas
 */
export async function getCommercialCampaignDetailsAction(campaignId: string) {
  const supabase = createClient();

  const { data: campaign, error } = await (supabase.from('campaigns') as any)
    .select('*, buyer:companies!campaigns_buyer_company_id_fkey(*), seller:companies!campaigns_seller_company_id_fkey(*), order:ad_offer_orders(*)')
    .eq('id', campaignId)
    .single();

  if (error || !campaign) {
    return { success: false, error: 'Campanha comercial não encontrada.' };
  }

  // Buscar Mídias Vinculadas
  const { data: campaignMedia } = await (supabase.from('campaign_media') as any)
    .select('*, media:media_assets(*)')
    .eq('campaign_id', campaignId);

  // Buscar Telas Vinculadas
  const { data: campaignScreens } = await (supabase.from('campaign_screens') as any)
    .select('*, screen:screens(*)')
    .eq('campaign_id', campaignId);

  // Buscar Livro de Entregas
  const { data: ledger } = await (supabase.from('ad_order_delivery_ledger') as any)
    .select('*')
    .eq('campaign_id', campaignId)
    .single();

  // Buscar Histórico de Entregas
  const { data: usageHistory } = await (supabase.from('ad_order_delivery_usage') as any)
    .select('*, screen:screens(*), media:media_assets(*)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(50);

  return {
    success: true,
    campaign,
    campaignMedia: campaignMedia || [],
    campaignScreens: campaignScreens || [],
    ledger: ledger || null,
    usageHistory: usageHistory || [],
  };
}

/**
 * 4. Obter Livro de Entregas por Pedido
 */
export async function getAdOrderDeliveryLedgerAction(orderId: string) {
  const supabase = createClient();

  const { data: ledger, error } = await (supabase.from('ad_order_delivery_ledger') as any)
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error || !ledger) {
    return { success: false, ledger: null };
  }

  return { success: true, ledger };
}
