'use server';

import { createClient } from '@/lib/supabase/server';
import { AdOfferStatus, AdOrderStatus, AdOrderPaymentStatus } from '@/types';

/**
 * 1. Obter Configurações de Receita da Plataforma
 */
export async function getPlatformRevenueSettingsAction() {
  const supabase = createClient();
  let { data: settings } = await (supabase.from('platform_revenue_settings') as any)
    .select('*')
    .eq('is_active', true)
    .single();

  if (!settings) {
    const { data: ns } = await (supabase.from('platform_revenue_settings') as any)
      .insert({
        default_platform_fee_percentage: 15.0,
        minimum_price_cents: 5000,
        allow_company_custom_fee: false,
        is_active: true,
      })
      .select()
      .single();
    settings = ns;
  }

  return { success: true, settings };
}

/**
 * 2. Atualizar Configurações Globais de Receita da Plataforma (Master Admin apenas)
 */
export async function updatePlatformRevenueSettingsAction(payload: {
  default_platform_fee_percentage?: number;
  minimum_price_cents?: number;
  allow_company_custom_fee?: boolean;
}) {
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

  if (!profile?.is_master_admin) {
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode alterar taxa da plataforma.' };
  }

  const { settings } = await getPlatformRevenueSettingsAction();

  const { error } = await (supabase.from('platform_revenue_settings') as any)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', settings.id);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    action: 'PLATFORM_REVENUE_SETTINGS_UPDATED',
    details: { changes: payload },
  });

  return { success: true };
}

/**
 * 3. Criar Card de Plano de Mídia (Admin da Empresa)
 */
export async function createAdOfferAction(
  companyId: string,
  payload: {
    title: string;
    description?: string | null;
    credits_amount: number;
    duration_seconds?: number;
    price_cents: number;
    valid_from?: string | null;
    valid_until?: string | null;
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Verificar se o usuário é Admin da empresa ou Master Admin
  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_master_admin) {
    const { data: link } = await (supabase.from('company_users') as any)
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!link || link.role !== 'admin') {
      return { success: false, error: 'Acesso negado: Apenas Admins da empresa ou Master Admin podem criar ofertas.' };
    }
  }

  // Verificação de Conformidade de Termos da Empresa Exibidora
  const { data: complianceResult } = await (supabase.rpc as any)('check_company_required_terms', {
    p_company_id: companyId,
  });

  if (complianceResult && complianceResult.compliant === false) {
    return {
      success: false,
      error: 'Existem termos comerciais pendentes de aceite para sua empresa antes de criar ofertas de mídia.',
    };
  }

  // Obter configurações globais da plataforma
  const { settings } = await getPlatformRevenueSettingsAction();
  const minPrice = settings.minimum_price_cents || 5000;
  const platformFeePercent = settings.default_platform_fee_percentage || 15.0;

  if (payload.price_cents < minPrice) {
    return {
      success: false,
      error: `Preço mínimo não atingido. O preço mínimo configurado na plataforma é R$ ${(minPrice / 100).toFixed(2)}.`,
    };
  }

  const { data: offer, error } = await (supabase.from('company_ad_offers') as any)
    .insert({
      company_id: companyId,
      title: payload.title,
      description: payload.description || null,
      credits_amount: payload.credits_amount,
      duration_seconds: payload.duration_seconds || 10,
      price_cents: payload.price_cents,
      platform_fee_percentage: platformFeePercent,
      status: 'draft',
      is_public: false,
      valid_from: payload.valid_from || null,
      valid_until: payload.valid_until || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !offer) {
    return { success: false, error: error?.message || 'Erro ao criar plano de mídia.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: companyId,
    action: 'COMPANY_AD_OFFER_CREATED',
    details: { offer_id: offer.id, title: payload.title, price_cents: payload.price_cents },
  });

  return { success: true, offer };
}

/**
 * 4. Editar Card de Plano de Mídia em Rascunho
 */
export async function updateAdOfferAction(
  offerId: string,
  payload: {
    title?: string;
    description?: string | null;
    credits_amount?: number;
    duration_seconds?: number;
    price_cents?: number;
    valid_from?: string | null;
    valid_until?: string | null;
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: offer } = await (supabase.from('company_ad_offers') as any)
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer) {
    return { success: false, error: 'Oferta não encontrada.' };
  }

  if (offer.status !== 'draft' && offer.status !== 'rejected') {
    return { success: false, error: 'Apenas ofertas em Rascunho ou Rejeitadas podem ser editadas.' };
  }

  const { error } = await (supabase.from('company_ad_offers') as any)
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: offer.company_id,
    action: 'COMPANY_AD_OFFER_UPDATED',
    details: { offer_id: offerId, changes: payload },
  });

  return { success: true };
}

/**
 * 5. Submeter Oferta para Revisão do Master Admin
 */
export async function submitAdOfferForReviewAction(offerId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: offer } = await (supabase.from('company_ad_offers') as any)
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer) {
    return { success: false, error: 'Oferta não encontrada.' };
  }

  const { error } = await (supabase.from('company_ad_offers') as any)
    .update({
      status: 'pending_review',
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: offer.company_id,
    action: 'COMPANY_AD_OFFER_SUBMITTED_FOR_REVIEW',
    details: { offer_id: offerId },
  });

  return { success: true };
}

/**
 * 6. Aprovar Oferta de Mídia (Master Admin apenas)
 */
export async function approveAdOfferAction(offerId: string) {
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

  if (!profile?.is_master_admin) {
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode aprovar ofertas.' };
  }

  const { data: offer } = await (supabase.from('company_ad_offers') as any)
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer) {
    return { success: false, error: 'Oferta não encontrada.' };
  }

  const { error } = await (supabase.from('company_ad_offers') as any)
    .update({
      status: 'active',
      is_public: true,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: offer.company_id,
    action: 'COMPANY_AD_OFFER_APPROVED',
    details: { offer_id: offerId },
  });

  return { success: true };
}

/**
 * 7. Rejeitar Oferta de Mídia com Motivo (Master Admin apenas)
 */
export async function rejectAdOfferAction(offerId: string, rejectionReason: string) {
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

  if (!profile?.is_master_admin) {
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode rejeitar ofertas.' };
  }

  const { data: offer } = await (supabase.from('company_ad_offers') as any)
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer) {
    return { success: false, error: 'Oferta não encontrada.' };
  }

  const { error } = await (supabase.from('company_ad_offers') as any)
    .update({
      status: 'rejected',
      is_public: false,
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: offer.company_id,
    action: 'COMPANY_AD_OFFER_REJECTED',
    details: { offer_id: offerId, reason: rejectionReason },
  });

  return { success: true };
}

/**
 * 8. Pausar Oferta de Mídia (Admin da Empresa ou Master Admin)
 */
export async function pauseAdOfferAction(offerId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: offer } = await (supabase.from('company_ad_offers') as any)
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer) {
    return { success: false, error: 'Oferta não encontrada.' };
  }

  const { error } = await (supabase.from('company_ad_offers') as any)
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: offer.company_id,
    action: 'COMPANY_AD_OFFER_PAUSED',
    details: { offer_id: offerId },
  });

  return { success: true };
}

/**
 * 9. Arquivar Oferta de Mídia
 */
export async function archiveAdOfferAction(offerId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: offer } = await (supabase.from('company_ad_offers') as any)
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer) {
    return { success: false, error: 'Oferta não encontrada.' };
  }

  const { error } = await (supabase.from('company_ad_offers') as any)
    .update({
      status: 'archived',
      is_public: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: offer.company_id,
    action: 'COMPANY_AD_OFFER_ARCHIVED',
    details: { offer_id: offerId },
  });

  return { success: true };
}

/**
 * 10. Listar Ofertas da Própria Empresa
 */
export async function getCompanyAdOffersAction(companyId: string) {
  const supabase = createClient();
  const { data, error } = await (supabase.from('company_ad_offers') as any)
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, offers: [] };
  }

  return { success: true, offers: data || [] };
}

/**
 * 11. Listar Todas as Ofertas para o Master Admin
 */
export async function getAllAdOffersForMasterAction() {
  const supabase = createClient();
  const { data, error } = await (supabase.from('company_ad_offers') as any)
    .select('*, company:companies(*)')
    .order('created_at', { ascending: false });

  if (error) {
    return { success: false, error: error.message, offers: [] };
  }

  return { success: true, offers: data || [] };
}

/**
 * 12. Criar Pedido de Oferta de Mídia (Congela valores brutos, comissão e líquido no momento)
 */
export async function createAdOfferOrderAction(payload: {
  offer_id: string;
  buyer_company_id?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  notes?: string | null;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // Buscar a oferta ativa
  const { data: offer } = await (supabase.from('company_ad_offers') as any)
    .select('*')
    .eq('id', payload.offer_id)
    .single();

  if (!offer) {
    return { success: false, error: 'Oferta não encontrada.' };
  }

  if (offer.status !== 'active') {
    return { success: false, error: 'Apenas ofertas ativas podem receber pedidos.' };
  }

  // Congelar valores da oferta no momento da solicitação
  const grossAmountCents = offer.price_cents;
  const platformFeePercent = offer.platform_fee_percentage;
  const platformFeeCents = offer.platform_fee_cents;
  const sellerNetCents = offer.seller_net_cents;
  const creditsAmount = offer.credits_amount;

  const { data: order, error } = await (supabase.from('ad_offer_orders') as any)
    .insert({
      offer_id: offer.id,
      seller_company_id: offer.company_id,
      buyer_company_id: payload.buyer_company_id || null,
      buyer_name: payload.buyer_name || null,
      buyer_email: payload.buyer_email || null,
      buyer_phone: payload.buyer_phone || null,
      gross_amount_cents: grossAmountCents,
      platform_fee_percentage: platformFeePercent,
      platform_fee_cents: platformFeeCents,
      seller_net_cents: sellerNetCents,
      credits_amount: creditsAmount,
      status: 'requested',
      payment_status: 'pending',
      notes: payload.notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !order) {
    return { success: false, error: error?.message || 'Erro ao criar pedido de oferta.' };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: offer.company_id,
    action: 'AD_OFFER_ORDER_CREATED',
    details: { order_id: order.id, offer_id: offer.id, gross_amount: grossAmountCents },
  });

  return { success: true, order };
}

/**
 * 13. Marcar Pedido como Pago Manualmente (Master Admin apenas)
 */
export async function markAdOfferOrderPaidManualAction(orderId: string, notes?: string) {
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

  if (!profile?.is_master_admin) {
    return { success: false, error: 'Acesso negado: Apenas Master Admin pode marcar pagamento manual.' };
  }

  const { data: order } = await (supabase.from('ad_offer_orders') as any)
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order) {
    return { success: false, error: 'Pedido não encontrado.' };
  }

  const { error } = await (supabase.from('ad_offer_orders') as any)
    .update({
      status: 'paid_manual',
      payment_status: 'paid_manual',
      notes: notes ? `${order.notes || ''} [Pago Manual: ${notes}]` : order.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: order.seller_company_id,
    action: 'AD_OFFER_ORDER_PAID_MANUAL',
    details: { order_id: orderId, gross_amount: order.gross_amount_cents },
  });

  return { success: true };
}

/**
 * 14. Listar Pedidos de Ofertas de Mídia
 */
export async function getAdOfferOrdersAction(companyId?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.', orders: [] };
  }

  const { data: profile } = await (supabase.from('profiles') as any)
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  let query = (supabase.from('ad_offer_orders') as any)
    .select('*, offer:company_ad_offers(*), seller:companies!ad_offer_orders_seller_company_id_fkey(*), buyer:companies!ad_offer_orders_buyer_company_id_fkey(*)')
    .order('created_at', { ascending: false });

  if (!profile?.is_master_admin && companyId) {
    query = query.or(`seller_company_id.eq.${companyId},buyer_company_id.eq.${companyId}`);
  }

  const { data, error } = await query;

  if (error) {
    return { success: false, error: error.message, orders: [] };
  }

  return { success: true, orders: data || [] };
}
