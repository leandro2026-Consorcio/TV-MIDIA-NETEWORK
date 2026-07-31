'use server';

import { createClient } from '@/lib/supabase/server';
import { syncAsaasPaymentStatusAction } from '@/app/actions/asaas-payments';
import { getAsaasPaymentDetails } from '@/lib/asaas';

/**
 * Funçao auxiliar de segurança: Valida estritamente se o usuário logado é Master Admin no Supabase
 */
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

/**
 * 1. Resumo Financeiro & KPIs de Conciliação Asaas (Acesso Exclusivo Master Admin)
 */
export async function getAsaasReconciliationSummaryAction() {
  const supabase = createClient();
  const { isMaster } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  // Buscar todos os pedidos com cobrança Asaas
  const { data: orders } = await (supabase.from('ad_offer_orders') as any)
    .select('id, gross_amount_cents, payment_status, status, asaas_payment_id');

  let totalGrossCents = 0;
  let totalConfirmedCents = 0;
  let totalPendingCents = 0;
  let totalOverdueCents = 0;
  let totalCancelledCents = 0;
  let totalRefundedCents = 0;
  let chargesCount = 0;

  (orders || []).forEach((ord: any) => {
    if (ord.asaas_payment_id || ord.payment_status?.includes('asaas') || ord.payment_status === 'pending_payment') {
      chargesCount++;
      const val = ord.gross_amount_cents || 0;
      totalGrossCents += val;

      if (ord.payment_status === 'paid_asaas' || ord.payment_status === 'paid_manual' || ord.status === 'converted_to_campaign') {
        totalConfirmedCents += val;
      } else if (ord.payment_status === 'overdue') {
        totalOverdueCents += val;
      } else if (ord.payment_status === 'cancelled') {
        totalCancelledCents += val;
      } else if (ord.payment_status === 'refunded') {
        totalRefundedCents += val;
      } else {
        totalPendingCents += val;
      }
    }
  });

  // Buscar volumetria de eventos webhook
  const { data: events } = await (supabase.from('asaas_payment_events') as any)
    .select('id, processing_status');

  let processedEventsCount = 0;
  let duplicateEventsCount = 0;
  let failedEventsCount = 0;
  let ignoredEventsCount = 0;

  (events || []).forEach((ev: any) => {
    if (ev.processing_status === 'processed') processedEventsCount++;
    else if (ev.processing_status === 'duplicate_ignored') duplicateEventsCount++;
    else if (ev.processing_status === 'failed') failedEventsCount++;
    else if (ev.processing_status === 'ignored') ignoredEventsCount++;
  });

  // Quantidade de revisões pendentes em asaas_reconciliation_reviews
  const { count: pendingReviewsCount } = await (supabase.from('asaas_reconciliation_reviews') as any)
    .select('*', { count: 'exact', head: true })
    .eq('review_status', 'pending_review');

  return {
    success: true,
    summary: {
      totalGrossCents,
      totalConfirmedCents,
      totalPendingCents,
      totalOverdueCents,
      totalCancelledCents,
      totalRefundedCents,
      chargesCount,
      totalEventsCount: (events || []).length,
      processedEventsCount,
      duplicateEventsCount,
      failedEventsCount,
      ignoredEventsCount,
      pendingReviewsCount: pendingReviewsCount || 0,
    },
  };
}

/**
 * 2. Lista de Cobranças Asaas por Pedido (Acesso Exclusivo Master Admin)
 */
export async function getAsaasPaymentsListAction(filters?: {
  status?: string;
  sellerId?: string;
  buyerId?: string;
}) {
  const supabase = createClient();
  const { isMaster } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  let query = (supabase.from('ad_offer_orders') as any)
    .select('*, seller:companies!ad_offer_orders_seller_company_id_fkey(*), buyer:companies!ad_offer_orders_buyer_company_id_fkey(*), campaign:campaigns!ad_offer_orders_campaign_id_fkey(*), offer:company_ad_offers(*)')
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('payment_status', filters.status);
  }
  if (filters?.sellerId) {
    query = query.eq('seller_company_id', filters.sellerId);
  }
  if (filters?.buyerId) {
    query = query.eq('buyer_company_id', filters.buyerId);
  }

  const { data: orders, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, orders: orders || [] };
}

/**
 * 3. Log Inspetor de Eventos Webhook Asaas com Revisão Mais Recente (Acesso Exclusivo Master Admin)
 */
export async function getAsaasPaymentEventsAction(filters?: {
  processingStatus?: string;
  eventType?: string;
}) {
  const supabase = createClient();
  const { isMaster } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  let query = (supabase.from('asaas_payment_events') as any)
    .select('*, order:ad_offer_orders(*)')
    .order('created_at', { ascending: false });

  if (filters?.processingStatus && filters.processingStatus !== 'all') {
    query = query.eq('processing_status', filters.processingStatus);
  }
  if (filters?.eventType && filters.eventType !== 'all') {
    query = query.eq('event_type', filters.eventType);
  }

  const { data: events, error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  // Anexar o parecer de revisão mais recente para cada evento (Opção A)
  const eventsWithReviews = await Promise.all(
    (events || []).map(async (ev: any) => {
      const { data: latestReview } = await (supabase.from('asaas_reconciliation_reviews') as any)
        .select('*')
        .eq('asaas_payment_event_id', ev.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        ...ev,
        latestReview: latestReview || null,
      };
    })
  );

  return { success: true, events: eventsWithReviews };
}

/**
 * 4. Detector de Anomalias e Inconformidades de Conciliação (Acesso Exclusivo Master Admin)
 */
export async function getAsaasPaymentAnomaliesAction() {
  const supabase = createClient();
  const { isMaster } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  const anomalies: any[] = [];

  // Anomalia 1: Webhooks recebidos sem pedido vinculado
  const { data: unlinkedEvents } = await (supabase.from('asaas_payment_events') as any)
    .select('*')
    .is('ad_offer_order_id', null)
    .order('created_at', { ascending: false });

  (unlinkedEvents || []).forEach((ev: any) => {
    anomalies.push({
      id: `unlinked_${ev.id}`,
      type: 'unlinked_webhook',
      severity: 'high',
      title: 'Webhook Asaas Sem Pedido Vinculado',
      description: `Evento ${ev.event_type} para pagamento ${ev.asaas_payment_id} recebido sem referência ao pedido interno.`,
      eventId: ev.id,
      paymentId: ev.asaas_payment_id,
      createdAt: ev.created_at,
    });
  });

  // Anomalia 2: Webhooks com erro (processing_status = 'failed')
  const { data: failedEvents } = await (supabase.from('asaas_payment_events') as any)
    .select('*')
    .eq('processing_status', 'failed')
    .order('created_at', { ascending: false });

  (failedEvents || []).forEach((ev: any) => {
    anomalies.push({
      id: `failed_${ev.id}`,
      type: 'webhook_failed',
      severity: 'high',
      title: 'Falha de Processamento de Webhook',
      description: ev.error_message || `Falha ao processar evento ${ev.event_type}`,
      eventId: ev.id,
      orderId: ev.ad_offer_order_id,
      paymentId: ev.asaas_payment_id,
      createdAt: ev.created_at,
    });
  });

  // Anomalia 3: Pedidos com status paid_asaas ou paid_manual sem campanha criada
  const { data: paidNoCampaign } = await (supabase.from('ad_offer_orders') as any)
    .select('*, seller:companies!ad_offer_orders_seller_company_id_fkey(*), buyer:companies!ad_offer_orders_buyer_company_id_fkey(*)')
    .in('payment_status', ['paid_asaas', 'paid_manual'])
    .is('campaign_id', null)
    .neq('status', 'converted_to_campaign');

  (paidNoCampaign || []).forEach((ord: any) => {
    anomalies.push({
      id: `paid_nocamp_${ord.id}`,
      type: 'paid_no_campaign',
      severity: 'medium',
      title: 'Pedido Pago Ainda Não Convertido em Campanha',
      description: `Pedido ${ord.id} de R$ ${(ord.gross_amount_cents / 100).toFixed(2)} possui pagamento confirmado mas não virou campanha comercial.`,
      orderId: ord.id,
      buyerName: ord.buyer?.trade_name || ord.buyer_name,
      sellerName: ord.seller?.trade_name,
      createdAt: ord.created_at,
    });
  });

  // Anomalia 4: Pedidos convertidos em campanha sem registro no seller_financial_ledger
  const { data: convertedOrders } = await (supabase.from('ad_offer_orders') as any)
    .select('id, seller_company_id, campaign_id, gross_amount_cents, created_at')
    .eq('status', 'converted_to_campaign');

  for (const ord of convertedOrders || []) {
    const { data: ledger } = await (supabase.from('seller_financial_ledger') as any)
      .select('id')
      .eq('ad_offer_order_id', ord.id)
      .single();

    if (!ledger) {
      anomalies.push({
        id: `no_ledger_${ord.id}`,
        type: 'converted_no_ledger',
        severity: 'high',
        title: 'Pedido Convertido Sem Registro no Extrato Financeiro',
        description: `O pedido ${ord.id} virou campanha comercial mas não possui linha no seller_financial_ledger.`,
        orderId: ord.id,
        campaignId: ord.campaign_id,
        createdAt: ord.created_at,
      });
    }
  }

  // Anomalia 5: Cobranças Vencidas ou Canceladas no Asaas
  const { data: overdueOrCancelled } = await (supabase.from('ad_offer_orders') as any)
    .select('id, gross_amount_cents, payment_status, asaas_payment_id, created_at')
    .in('payment_status', ['overdue', 'cancelled', 'refunded']);

  (overdueOrCancelled || []).forEach((ord: any) => {
    anomalies.push({
      id: `overdue_cancelled_${ord.id}`,
      type: 'charge_overdue_cancelled',
      severity: 'low',
      title: `Cobrança Asaas ${ord.payment_status.toUpperCase()}`,
      description: `Pedido ${ord.id} está com cobrança em status ${ord.payment_status}.`,
      orderId: ord.id,
      paymentId: ord.asaas_payment_id,
      createdAt: ord.created_at,
    });
  });

  // Anexar parecer contábil mais recente para cada anomalia
  const anomaliesWithReviews = await Promise.all(
    anomalies.map(async (anom) => {
      let query = (supabase.from('asaas_reconciliation_reviews') as any).select('*');
      if (anom.eventId) query = query.eq('asaas_payment_event_id', anom.eventId);
      else if (anom.orderId) query = query.eq('ad_offer_order_id', anom.orderId);

      const { data: review } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        ...anom,
        latestReview: review || null,
      };
    })
  );

  return { success: true, anomalies: anomaliesWithReviews };
}

/**
 * 5. Sincronização Manual por Master Admin com Re-validação da Fase 5A
 */
export async function syncAsaasPaymentFromAdminAction(orderId: string) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  // Invocar ação de sincronização reaplicando validação de valor, externalReference e status da Fase 5A
  const result = await syncAsaasPaymentStatusAction(orderId);

  if (result.success) {
    await (supabase.from('audit_logs') as any).insert({
      user_id: userId,
      action: 'ASAAS_ADMIN_MANUAL_PAYMENT_SYNCED',
      details: { order_id: orderId, result },
    });
  }

  return result;
}

/**
 * 6. Hardening de Reprocessamento Seguro de Evento de Webhook pelo Master Admin
 */
export async function reprocessAsaasPaymentEventAction(eventId: string) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  // A. Buscar evento em asaas_payment_events
  const { data: event } = await (supabase.from('asaas_payment_events') as any)
    .select('*')
    .eq('id', eventId)
    .single();

  if (!event) {
    return { success: false, error: 'Evento de webhook não encontrado.' };
  }

  const targetOrderId = event.ad_offer_order_id || event.raw_payload?.payment?.externalReference;
  const asaasPaymentId = event.asaas_payment_id;

  if (!targetOrderId || !asaasPaymentId) {
    return { success: false, error: 'Não é possível reprocessar evento sem identificador do pedido ou payment_id.' };
  }

  // B. Buscar pedido e validar elegibilidade
  const { data: order } = await (supabase.from('ad_offer_orders') as any)
    .select('*')
    .eq('id', targetOrderId)
    .single();

  if (!order) {
    return { success: false, error: 'Pedido correspondente não encontrado para reprocessamento.' };
  }

  // Pedidos cancelados, rejeitados ou já convertidos em campanha não sofrem reprocessamento mutável
  if (order.status === 'cancelled' || order.status === 'rejected' || order.status === 'converted_to_campaign') {
    return { success: false, error: `Pedido em status inalterável: ${order.status}` };
  }

  // C. Obter detalhes atualizados diretamente da API REST do Asaas (Sandbox/Produção)
  try {
    const details = await getAsaasPaymentDetails(asaasPaymentId);
    const asaasStatus = details.status;
    const asaasValue = parseFloat(details.value || 0);
    const expectedValue = order.gross_amount_cents / 100;

    // D. Validar externalReference
    if (details.externalReference && details.externalReference !== order.id) {
      return { success: false, error: 'Divergência de externalReference entre Asaas e Pedido.' };
    }

    // E. Validar consistência de valor pago
    if (Math.abs(asaasValue - expectedValue) > 0.01) {
      return { success: false, error: `Divergência de valor: Recebido R$ ${asaasValue}, Esperado R$ ${expectedValue}.` };
    }

    // F. Atualizar status local apenas se realmente confirmado
    let isConfirmed = false;
    if (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED' || asaasStatus === 'RECEIVED_IN_CASH') {
      isConfirmed = true;
    }

    if (isConfirmed) {
      await (supabase.from('ad_offer_orders') as any)
        .update({
          payment_status: 'paid_asaas',
          status: 'paid_asaas',
          asaas_payment_id: asaasPaymentId,
          payment_confirmed_at: new Date().toISOString(),
          payment_webhook_last_event: `REPROCESS_${event.event_type}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      await (supabase.from('asaas_payment_events') as any)
        .update({
          processing_status: 'processed',
          error_message: `Reprocessado com sucesso por Master Admin em ${new Date().toISOString()}`,
        })
        .eq('id', eventId);

      await (supabase.from('audit_logs') as any).insert({
        user_id: userId,
        company_id: order.seller_company_id,
        action: 'ASAAS_ADMIN_WEBHOOK_EVENT_REPROCESSED',
        details: { event_id: eventId, order_id: order.id, asaas_status: asaasStatus, value: asaasValue },
      });

      return { success: true, message: 'Evento reprocessado e pagamento confirmado com sucesso!' };
    } else {
      return { success: false, error: `Cobrança no Asaas em status não confirmado: ${asaasStatus}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao consultar API Asaas para reprocessamento.' };
  }
}

/**
 * 7. Registrar Parecer de Revisão Contábil (Histórico Opção A - Acesso Exclusivo Master Admin)
 */
export async function markAsaasEventReviewedAction(params: {
  eventId?: string;
  orderId?: string;
  reviewStatus: 'pending_review' | 'reviewed' | 'ignored' | 'resolved';
  notes?: string;
}) {
  const supabase = createClient();
  const { isMaster, userId } = await checkMasterAdmin(supabase);

  if (!isMaster) {
    return { success: false, error: 'Acesso restrito ao Master Admin.' };
  }

  const { data: review, error } = await (supabase.from('asaas_reconciliation_reviews') as any)
    .insert({
      asaas_payment_event_id: params.eventId || null,
      ad_offer_order_id: params.orderId || null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_status: params.reviewStatus,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  await (supabase.from('audit_logs') as any).insert({
    user_id: userId,
    action: 'ASAAS_RECONCILIATION_REVIEWED',
    details: { review_id: review.id, ...params },
  });

  return { success: true, review };
}
