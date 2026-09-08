import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ASAAS_WEBHOOK_TOKEN } from '@/lib/asaas';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    // 1. Validar Header asaas-access-token
    const accessTokenHeader = req.headers.get('asaas-access-token');
    if (ASAAS_WEBHOOK_TOKEN && accessTokenHeader !== ASAAS_WEBHOOK_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticação do Webhook Asaas inválido.' },
        { status: 401 }
      );
    }

    const payload = await req.json();
    const eventType = payload.event;
    const payment = payload.payment;

    if (!eventType || !payment || !payment.id) {
      return NextResponse.json(
        { success: false, error: 'Payload de webhook malformado.' },
        { status: 400 }
      );
    }

    const asaasPaymentId = String(payment.id);
    const externalReference = payment.externalReference ? String(payment.externalReference) : null;
    const paymentStatus = payment.status || 'UNKNOWN';
    const paymentValue = parseFloat(payment.value || 0);

    // 2. Calcular webhook_idempotency_key por prioridade estrita
    let idempotencyKey: string;

    if (payload.id || payload.event_id) {
      idempotencyKey = String(payload.id || payload.event_id);
    } else if (payment.confirmedDate || payment.clientPaymentDate) {
      idempotencyKey = `${eventType}_${asaasPaymentId}_${paymentStatus}_${payment.confirmedDate || payment.clientPaymentDate}`;
    } else {
      const payloadHash = crypto.createHash('md5').update(JSON.stringify(payload)).digest('hex');
      idempotencyKey = `${eventType}_${asaasPaymentId}_${payloadHash}`;
    }

    // 3. Verificar duplicidade e registrar em asaas_payment_events (Idempotência Estrita)
    const { data: existingEvent } = await supabaseAdmin
      .from('asaas_payment_events')
      .select('id, processing_status')
      .eq('webhook_idempotency_key', idempotencyKey)
      .single();

    if (existingEvent) {
      return NextResponse.json(
        { success: true, message: 'Evento duplicado ignorado por idempotência.', processing_status: 'duplicate_ignored' },
        { status: 200 }
      );
    }

    // Cobranças de assinatura usam a mesma integração e o mesmo webhook,
    // identificadas sem colisão com pedidos de mídia legados.
    if (externalReference?.startsWith('expansion:')) {
      const expansionPaymentId = externalReference.slice('expansion:'.length);
      const { data: intent } = await (supabaseAdmin.from('expansion_payments') as any)
        .select('id,subscription_id,payment_kind,period_reference,amount_cents,idempotency_key,provider_payment_id')
        .eq('id', expansionPaymentId).maybeSingle();
      if (!intent || (intent.provider_payment_id && intent.provider_payment_id !== asaasPaymentId)) {
        return NextResponse.json({ success: false, error: 'Cobrança de expansão não localizada ou divergente.' }, { status: 409 });
      }
      if (Math.abs(paymentValue - Number(intent.amount_cents) / 100) > 0.01) {
        return NextResponse.json({ success: false, error: 'Valor divergente na cobrança de expansão.' }, { status: 409 });
      }
      const confirmed = ['PAYMENT_RECEIVED','PAYMENT_CONFIRMED'].includes(eventType) || ['RECEIVED','CONFIRMED','RECEIVED_IN_CASH'].includes(paymentStatus);
      const reversed = ['PAYMENT_REFUNDED','PAYMENT_CHARGEBACK','PAYMENT_DELETED'].includes(eventType) || ['REFUNDED','CHARGEBACK','CANCELLED'].includes(paymentStatus);
      if (confirmed) {
        const { error: expansionError } = await (supabaseAdmin.rpc as any)('record_expansion_payment', {
          p_subscription: intent.subscription_id, p_payment_kind: intent.payment_kind, p_period_reference: intent.period_reference,
          p_amount_cents: intent.amount_cents, p_provider_payment_id: asaasPaymentId, p_idempotency_key: intent.idempotency_key,
        });
        if (expansionError) throw expansionError;
      } else if (reversed) {
        const { error: reversalError } = await (supabaseAdmin.rpc as any)('reverse_expansion_payment', {
          p_payment: intent.id, p_reason: `${eventType}:${paymentStatus}`, p_idempotency_key: `asaas:${idempotencyKey}`,
        });
        if (reversalError) throw reversalError;
      } else {
        await (supabaseAdmin.from('expansion_payments') as any).update({ status: paymentStatus === 'OVERDUE' ? 'overdue' : 'pending', updated_at: new Date().toISOString() }).eq('id', intent.id);
      }
      await supabaseAdmin.from('asaas_payment_events').insert({
        webhook_idempotency_key: idempotencyKey, asaas_event_id: payload.id || null, asaas_payment_id: asaasPaymentId,
        ad_offer_order_id: null, event_type: eventType, payment_status: paymentStatus, raw_payload: payload,
        processing_status: 'processed', error_message: `expansion_payment:${intent.id}`,
      });
      return NextResponse.json({ success: true, processing_status: 'processed', expansion_payment_id: intent.id });
    }

    // 4. Localizar pedido obrigatoriamente por externalReference (ad_offer_order_id) ou asaas_payment_id
    let matchedOrder: any = null;

    if (externalReference) {
      const { data: ord } = await supabaseAdmin
        .from('ad_offer_orders')
        .select('*')
        .eq('id', externalReference)
        .single();
      matchedOrder = ord;
    }

    if (!matchedOrder && asaasPaymentId) {
      const { data: ord } = await supabaseAdmin
        .from('ad_offer_orders')
        .select('*')
        .eq('asaas_payment_id', asaasPaymentId)
        .single();
      matchedOrder = ord;
    }

    // Se o pedido não existir, apenas registrar evento em asaas_payment_events como ignored
    if (!matchedOrder) {
      await supabaseAdmin.from('asaas_payment_events').insert({
        webhook_idempotency_key: idempotencyKey,
        asaas_event_id: payload.id || null,
        asaas_payment_id: asaasPaymentId,
        ad_offer_order_id: null,
        event_type: eventType,
        payment_status: paymentStatus,
        raw_payload: payload,
        processing_status: 'ignored',
        error_message: 'Pedido não localizado por externalReference ou asaas_payment_id.',
      });

      return NextResponse.json(
        { success: true, message: 'Evento registrado mas pedido não encontrado.', processing_status: 'ignored' },
        { status: 200 }
      );
    }

    // 5. Validar consistência do pedido encontrado
    // Se o pedido já possui um asaas_payment_id diferente, recusa vinculação cruzada
    if (matchedOrder.asaas_payment_id && matchedOrder.asaas_payment_id !== asaasPaymentId) {
      await supabaseAdmin.from('asaas_payment_events').insert({
        webhook_idempotency_key: idempotencyKey,
        asaas_event_id: payload.id || null,
        asaas_payment_id: asaasPaymentId,
        ad_offer_order_id: matchedOrder.id,
        event_type: eventType,
        payment_status: paymentStatus,
        raw_payload: payload,
        processing_status: 'failed',
        error_message: 'Divergência de asaas_payment_id no pedido.',
      });

      return NextResponse.json(
        { success: true, message: 'Divergência de identificador de pagamento no pedido.', processing_status: 'failed' },
        { status: 200 }
      );
    }

    // Validar status do pedido: pedidos cancelados, rejeitados ou já convertidos não podem sofrer alteração automática de pagamento
    if (matchedOrder.status === 'cancelled' || matchedOrder.status === 'rejected' || matchedOrder.status === 'converted_to_campaign') {
      await supabaseAdmin.from('asaas_payment_events').insert({
        webhook_idempotency_key: idempotencyKey,
        asaas_event_id: payload.id || null,
        asaas_payment_id: asaasPaymentId,
        ad_offer_order_id: matchedOrder.id,
        event_type: eventType,
        payment_status: paymentStatus,
        raw_payload: payload,
        processing_status: 'ignored',
        error_message: `Pedido em status inalterável: ${matchedOrder.status}`,
      });

      return NextResponse.json(
        { success: true, message: `Evento ignorado pois pedido está em status ${matchedOrder.status}.`, processing_status: 'ignored' },
        { status: 200 }
      );
    }

    // 6. Validar Valor Pago (Divergência de Valor)
    const expectedValue = matchedOrder.gross_amount_cents / 100;
    if (Math.abs(paymentValue - expectedValue) > 0.01) {
      await supabaseAdmin.from('asaas_payment_events').insert({
        webhook_idempotency_key: idempotencyKey,
        asaas_event_id: payload.id || null,
        asaas_payment_id: asaasPaymentId,
        ad_offer_order_id: matchedOrder.id,
        event_type: eventType,
        payment_status: paymentStatus,
        raw_payload: payload,
        processing_status: 'failed',
        error_message: `Divergência de valor: Recebido R$ ${paymentValue}, Esperado R$ ${expectedValue}`,
      });

      await supabaseAdmin.from('audit_logs').insert({
        company_id: matchedOrder.seller_company_id,
        action: 'ASAAS_WEBHOOK_AMOUNT_MISMATCH',
        details: {
          order_id: matchedOrder.id,
          received_value: paymentValue,
          expected_value: expectedValue,
        },
      });

      return NextResponse.json(
        { success: true, message: 'Divergência de valor do pagamento registrada.', processing_status: 'failed' },
        { status: 200 }
      );
    }

    // 7. Gravar o evento em asaas_payment_events como processado
    await supabaseAdmin.from('asaas_payment_events').insert({
      webhook_idempotency_key: idempotencyKey,
      asaas_event_id: payload.id || null,
      asaas_payment_id: asaasPaymentId,
      ad_offer_order_id: matchedOrder.id,
      event_type: eventType,
      payment_status: paymentStatus,
      raw_payload: payload,
      processing_status: 'processed',
    });

    // 8. Atualizar status do pedido apenas se o evento/status for de PAGAMENTO CONFIRMADO
    const isConfirmedEvent =
      eventType === 'PAYMENT_RECEIVED' ||
      eventType === 'PAYMENT_CONFIRMED' ||
      paymentStatus === 'RECEIVED' ||
      paymentStatus === 'CONFIRMED' ||
      paymentStatus === 'RECEIVED_IN_CASH';

    if (isConfirmedEvent) {
      await supabaseAdmin
        .from('ad_offer_orders')
        .update({
          payment_status: 'paid_asaas',
          status: 'paid_asaas',
          asaas_payment_id: asaasPaymentId,
          payment_confirmed_at: new Date().toISOString(),
          payment_webhook_last_event: eventType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchedOrder.id);

      await supabaseAdmin.from('audit_logs').insert({
        company_id: matchedOrder.seller_company_id,
        action: 'ASAAS_PAYMENT_CONFIRMED_VIA_WEBHOOK',
        details: {
          order_id: matchedOrder.id,
          asaas_payment_id: asaasPaymentId,
          event_type: eventType,
          value: paymentValue,
        },
      });
    } else {
      // Tratar eventos de não pagamento (Overdue, Refunded, Cancelled)
      let nonPaidStatus = matchedOrder.payment_status;

      if (eventType === 'PAYMENT_OVERDUE' || paymentStatus === 'OVERDUE') {
        nonPaidStatus = 'overdue';
      } else if (eventType === 'PAYMENT_REFUNDED' || paymentStatus === 'REFUNDED') {
        nonPaidStatus = 'refunded';
      } else if (eventType === 'PAYMENT_DELETED' || paymentStatus === 'CANCELLED') {
        nonPaidStatus = 'cancelled';
      }

      await supabaseAdmin
        .from('ad_offer_orders')
        .update({
          payment_status: nonPaidStatus,
          payment_webhook_last_event: eventType,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchedOrder.id);

      await supabaseAdmin.from('audit_logs').insert({
        company_id: matchedOrder.seller_company_id,
        action: 'ASAAS_PAYMENT_NON_PAID_EVENT',
        details: {
          order_id: matchedOrder.id,
          asaas_payment_id: asaasPaymentId,
          event_type: eventType,
          status: nonPaidStatus,
        },
      });
    }

    return NextResponse.json(
      { success: true, message: 'Evento de webhook Asaas processado com sucesso.', order_id: matchedOrder.id },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro interno ao processar webhook do Asaas.' },
      { status: 500 }
    );
  }
}
