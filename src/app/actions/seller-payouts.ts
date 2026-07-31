'use server';

import { createClient } from '@/lib/supabase/server';

async function checkMasterAdmin(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isMaster: false, userId: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_master_admin')
    .eq('id', user.id)
    .single();

  return { isMaster: !!profile?.is_master_admin, userId: user.id };
}

async function checkCompanyMember(supabase: any, companyId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { isMember: false, isMaster: false, userId: null };

  const { isMaster } = await checkMasterAdmin(supabase);
  if (isMaster) return { isMember: true, isMaster: true, userId: user.id };

  const { data: cu } = await supabase
    .from('company_users')
    .select('id')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  return { isMember: !!cu, isMaster: false, userId: user.id };
}

/**
 * 1. Calcular Motor de Elegibilidade de Payout por Pedido (Passivo Sem Movimentação)
 */
export async function calculateSellerPayoutEligibilityAction(orderId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // A. Buscar Pedido com Relações
  const { data: order } = await (supabase.from('ad_offer_orders') as any)
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order) {
    return { success: false, error: 'Pedido não encontrado.' };
  }

  const sellerCompanyId = order.seller_company_id;

  // B. Buscar Campanha, Delivery Ledger, Financial Ledger, Seller Financial Profile, Eventos Asaas e Revisões Contábeis
  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*')
    .eq('ad_offer_order_id', order.id)
    .single();

  const { data: deliveryLedger } = await (supabase.from('ad_order_delivery_ledger') as any)
    .select('*')
    .eq('order_id', order.id)
    .single();

  const { data: financialLedger } = await (supabase.from('seller_financial_ledger') as any)
    .select('*')
    .eq('ad_offer_order_id', order.id)
    .single();

  const { data: sellerProfile } = await (supabase.from('seller_financial_profiles') as any)
    .select('*')
    .eq('company_id', sellerCompanyId)
    .single();

  // Buscar eventos de pagamento Asaas para verificação de anomalias/estornos
  const { data: asaasEvents } = await (supabase.from('asaas_payment_events') as any)
    .select('*')
    .eq('ad_offer_order_id', order.id);

  // Buscar revisões de conciliação contábil pendentes
  const { data: pendingReviews } = await (supabase.from('asaas_reconciliation_reviews') as any)
    .select('*')
    .eq('ad_offer_order_id', order.id)
    .eq('review_status', 'pending_review');

  // C. Avaliar as 13 Regras de Elegibilidade com Hardening Estrito

  let isEligible = true;
  let status = 'eligible';
  let reason = 'Apto para repasse/split futuro.';

  const hasFailedEvent = (asaasEvents || []).some(
    (e: any) =>
      e.processing_status === 'failed' ||
      e.event_type?.includes('REFUND') ||
      e.event_type?.includes('DELETED') ||
      e.event_type?.includes('CHARGEBACK')
  );

  const hasPendingReview = (pendingReviews || []).length > 0;

  // Regra 1: Anomalia Asaas Crítica ou Revisão Contábil Pendente
  if (hasFailedEvent || hasPendingReview) {
    isEligible = false;
    status = 'blocked';
    reason = 'Bloqueado por anomalia Asaas ou parecer contábil pendente de revisão.';
  }

  // Regra 2: Pedido Pago
  else if (
    order.payment_status !== 'paid_asaas' &&
    order.payment_status !== 'paid_manual' &&
    order.status !== 'paid_asaas' &&
    order.status !== 'paid_manual' &&
    order.status !== 'converted_to_campaign'
  ) {
    isEligible = false;
    status = 'not_eligible';
    reason = 'Pedido não possui pagamento confirmado.';
  }

  // Regra 3 & 4: Campanha Convertida e Existente
  else if (!campaign || order.status !== 'converted_to_campaign') {
    isEligible = false;
    status = 'pending_delivery';
    reason = 'Pedido ainda não foi convertido em campanha comercial ativa.';
  }

  // Regra 5 & 6: Entrega Comprovada via Proof of Play (ad_order_delivery_ledger.status = 'completed')
  else if (!deliveryLedger || deliveryLedger.status !== 'completed') {
    isEligible = false;
    status = 'pending_delivery';
    reason = `Veiculação em andamento (${deliveryLedger?.credits_delivered || 0}/${deliveryLedger?.credits_contracted || order.credits_amount} inserções).`;
  }

  // Regra 7 & 8: Extrato Financeiro Promovido a Disponível com Saldo Positivo (seller_financial_ledger)
  else if (
    !financialLedger ||
    (financialLedger.financial_status !== 'available' && financialLedger.financial_status !== 'partially_used') ||
    (financialLedger.amount_available_cents || 0) <= 0
  ) {
    isEligible = false;
    status = financialLedger?.financial_status === 'used_for_discount' ? 'blocked' : 'pending_delivery';
    reason =
      financialLedger?.financial_status === 'used_for_discount' || (financialLedger?.amount_available_cents || 0) <= 0
        ? 'Saldo disponível zerado ou totalmente consumido por abatimento de mensalidade.'
        : 'Extrato financeiro do exibidor ainda pendente de liberação de entrega.';
  }

  // Regra 9 & 10: Cadastro Financeiro da Exibidora APROVADO e não SUSPENSO
  else if (!sellerProfile || sellerProfile.verification_status !== 'approved') {
    isEligible = false;
    status = 'pending_financial_profile';
    reason = `Cadastro financeiro da exibidora não homologado (Status: ${sellerProfile?.verification_status || 'ausente'}).`;
  }

  // Regra 11 & 12: Identificador Asaas / Carteira Válida
  else if (!sellerProfile.asaas_account_id && !sellerProfile.asaas_wallet_id) {
    isEligible = false;
    status = 'pending_asaas_wallet';
    reason = 'Exibidora não possui subconta/carteira Asaas vinculada.';
  }

  // D. Calcular Valores Elegíveis e Inelegíveis Baseados ESTRITAMENTE no amount_available_cents
  const availableCents = financialLedger?.amount_available_cents || 0;
  const netCents = order.seller_net_cents || 0;

  const eligibleAmountCents = isEligible ? availableCents : 0;
  const ineligibleAmountCents = isEligible ? 0 : netCents;

  const payload = {
    seller_company_id: sellerCompanyId,
    buyer_company_id: order.buyer_company_id || null,
    ad_offer_order_id: order.id,
    campaign_id: campaign?.id || null,
    seller_financial_ledger_id: financialLedger?.id || null,
    asaas_payment_id: order.asaas_payment_id || null,
    gross_amount_cents: order.gross_amount_cents,
    platform_fee_cents: order.platform_fee_cents,
    seller_net_cents: netCents,
    eligible_amount_cents: eligibleAmountCents,
    ineligible_amount_cents: ineligibleAmountCents,
    eligibility_status: status,
    eligibility_reason: reason,
    delivery_status: deliveryLedger?.status || 'in_progress',
    financial_status: financialLedger?.financial_status || 'pending_delivery',
    seller_verification_status: sellerProfile?.verification_status || 'draft',
    asaas_status: sellerProfile?.asaas_status || 'not_created',
    asaas_wallet_id: sellerProfile?.asaas_wallet_id || sellerProfile?.asaas_account_id || null,
    calculated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: record, error } = await (supabase.from('seller_payout_eligibility') as any)
    .upsert(payload, { onConflict: 'ad_offer_order_id' })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: user.id,
    company_id: sellerCompanyId,
    action: 'SELLER_PAYOUT_ELIGIBILITY_CALCULATED',
    details: { order_id: order.id, status, eligible_amount_cents: eligibleAmountCents, reason },
  });

  return { success: true, eligibility: record };
}

/**
 * 2. Obter Elegibilidade Globais para Master Admin
 */
export async function getSellerPayoutEligibilityForAdminAction(filters?: {
  status?: string;
  sellerId?: string;
}) {
  const supabase = createClient();
  const { isMaster } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  let query = (supabase.from('seller_payout_eligibility') as any)
    .select('*, seller:companies!seller_payout_eligibility_seller_company_id_fkey(*), buyer:companies!seller_payout_eligibility_buyer_company_id_fkey(*), campaign:campaigns!seller_payout_eligibility_campaign_id_fkey(*), order:ad_offer_orders(*)')
    .order('updated_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('eligibility_status', filters.status);
  }
  if (filters?.sellerId) {
    query = query.eq('seller_company_id', filters.sellerId);
  }

  const { data: records, error } = await query;

  if (error) return { success: false, error: error.message };
  return { success: true, eligibilities: records || [] };
}

/**
 * 3. Obter Elegibilidade da Empresa Exibidora
 */
export async function getSellerPayoutEligibilityForSellerAction(companyId: string) {
  const supabase = createClient();
  const { isMember } = await checkCompanyMember(supabase, companyId);

  if (!isMember) {
    return { success: false, error: 'Acesso negado para esta empresa.' };
  }

  const { data: records, error } = await (supabase.from('seller_payout_eligibility') as any)
    .select('*, campaign:campaigns!seller_payout_eligibility_campaign_id_fkey(*), order:ad_offer_orders(*)')
    .eq('seller_company_id', companyId)
    .order('updated_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, eligibilities: records || [] };
}

/**
 * 4. Obter Resumo de Totais de Payout (Elegíveis vs Bloqueados)
 */
export async function getSellerPayoutSummaryAction(companyId?: string) {
  const supabase = createClient();
  const { isMaster } = await checkMasterAdmin(supabase);

  let query = (supabase.from('seller_payout_eligibility') as any).select('*');

  if (!isMaster && companyId) {
    query = query.eq('seller_company_id', companyId);
  } else if (companyId) {
    query = query.eq('seller_company_id', companyId);
  }

  const { data: records } = await query;

  let totalGrossCents = 0;
  let totalPlatformFeeCents = 0;
  let totalSellerNetCents = 0;
  let totalEligibleCents = 0;
  let totalBlockedCents = 0;

  let eligibleCount = 0;
  let pendingCount = 0;

  (records || []).forEach((r: any) => {
    totalGrossCents += r.gross_amount_cents || 0;
    totalPlatformFeeCents += r.platform_fee_cents || 0;
    totalSellerNetCents += r.seller_net_cents || 0;
    totalEligibleCents += r.eligible_amount_cents || 0;
    totalBlockedCents += r.ineligible_amount_cents || 0;

    if (r.eligibility_status === 'eligible') eligibleCount++;
    else pendingCount++;
  });

  return {
    success: true,
    summary: {
      totalGrossCents,
      totalPlatformFeeCents,
      totalSellerNetCents,
      totalEligibleCents,
      totalBlockedCents,
      eligibleCount,
      pendingCount,
      totalCount: (records || []).length,
    },
  };
}

/**
 * 5. Criar Simulação de Lote por Período (Exclusivo Master Admin - Fotografia Contábil Passiva)
 */
export async function createSellerPayoutSimulationAction(
  sellerCompanyId: string,
  periodStart: string,
  periodEnd: string
) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster || !userId) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  const { data: records } = await (supabase.from('seller_payout_eligibility') as any)
    .select('*')
    .eq('seller_company_id', sellerCompanyId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd);

  let totalGrossCents = 0;
  let totalPlatformFeeCents = 0;
  let totalSellerNetCents = 0;
  let totalEligibleCents = 0;
  let totalBlockedCents = 0;

  (records || []).forEach((r: any) => {
    totalGrossCents += r.gross_amount_cents || 0;
    totalPlatformFeeCents += r.platform_fee_cents || 0;
    totalSellerNetCents += r.seller_net_cents || 0;
    totalEligibleCents += r.eligible_amount_cents || 0;
    totalBlockedCents += r.ineligible_amount_cents || 0;
  });

  const { data: sim, error } = await (supabase.from('seller_payout_simulations') as any)
    .insert({
      seller_company_id: sellerCompanyId,
      period_start: periodStart,
      period_end: periodEnd,
      total_gross_cents: totalGrossCents,
      total_platform_fee_cents: totalPlatformFeeCents,
      total_seller_net_cents: totalSellerNetCents,
      total_eligible_cents: totalEligibleCents,
      total_blocked_cents: totalBlockedCents,
      created_by: userId,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    company_id: sellerCompanyId,
    action: 'SELLER_PAYOUT_SIMULATION_CREATED',
    details: { simulation_id: sim.id, total_eligible_cents: totalEligibleCents },
  });

  return { success: true, simulation: sim };
}

/**
 * 6. Recalcular Elegibilidade Global ou por Exibidora (Exclusivo Master Admin)
 */
export async function recalculateSellerPayoutEligibilityAction(sellerCompanyId?: string) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  let query = (supabase.from('ad_offer_orders') as any).select('id');
  if (sellerCompanyId) {
    query = query.eq('seller_company_id', sellerCompanyId);
  }

  const { data: orders } = await query;

  let recalculatedCount = 0;
  for (const ord of orders || []) {
    await calculateSellerPayoutEligibilityAction(ord.id);
    recalculatedCount++;
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    action: 'SELLER_PAYOUT_ELIGIBILITY_RECALCULATED',
    details: { seller_company_id: sellerCompanyId || 'ALL', recalculated_count: recalculatedCount },
  });

  return { success: true, recalculatedCount };
}
