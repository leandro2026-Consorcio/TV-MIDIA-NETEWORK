'use server';

import { createClient } from '@/lib/supabase/server';
import { 
  createOrGetAsaasCustomer, 
  createAsaasPayment, 
  getAsaasPaymentDetails, 
  getAsaasPixQrCode, 
  cancelAsaasPayment 
} from '@/lib/asaas';

/**
 * 1. Criar Cobrança no Asaas para Pedido de Mídia Aprovado
 */
export async function createAsaasPaymentForOrderAction(
  orderId: string,
  billingType: 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD' = 'UNDEFINED'
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  // A. Buscar Pedido com Empresas Compradora e Vendedora
  const { data: order } = await (supabase.from('ad_offer_orders') as any)
    .select('*, buyer:companies!ad_offer_orders_buyer_company_id_fkey(*), seller:companies!ad_offer_orders_seller_company_id_fkey(*), offer:company_ad_offers(*)')
    .eq('id', orderId)
    .single();

  if (!order) {
    return { success: false, error: 'Pedido de oferta de mídia não encontrado.' };
  }

  // B. Validar status do pedido
  if (order.approval_status !== 'approved' && order.status !== 'approved' && order.status !== 'requested') {
    return { success: false, error: 'Apenas pedidos com solicitação aprovada pela exibidora podem gerar cobrança.' };
  }

  if (order.status === 'paid_manual' || order.status === 'paid_asaas' || order.status === 'converted_to_campaign') {
    return { success: false, error: 'Este pedido já possui pagamento confirmado.' };
  }

  // C. Evitar duplicidade de cobrança ativa no Asaas
  if (order.asaas_payment_id && order.asaas_invoice_url) {
    return {
      success: true,
      alreadyExists: true,
      payment: {
        asaas_payment_id: order.asaas_payment_id,
        invoiceUrl: order.asaas_invoice_url,
        bankSlipUrl: order.asaas_bank_slip_url,
        pixQrCode: order.asaas_pix_qr_code,
        pixCopyPaste: order.asaas_pix_copy_paste,
      },
    };
  }

  // D. Validar Conformidade de Termos (4D)
  if (order.buyer_company_id) {
    const { data: buyerComp } = await (supabase.rpc as any)('check_company_required_terms', {
      p_company_id: order.buyer_company_id,
    });
    if (buyerComp && buyerComp.compliant === false) {
      return { success: false, error: 'Existem termos comerciais pendentes de aceite para sua empresa antes de realizar o pagamento.' };
    }
  }

  const { data: sellerComp } = await (supabase.rpc as any)('check_company_required_terms', {
    p_company_id: order.seller_company_id,
  });
  if (sellerComp && sellerComp.compliant === false) {
    return { success: false, error: 'Existem termos comerciais pendentes de aceite para a empresa exibidora antes de prosseguir.' };
  }

  try {
    // E. Criar ou Obter Cliente no Asaas
    const customerName = order.buyer?.trade_name || order.buyer_name || 'Anunciante Rede Indoor';
    const customerEmail = order.buyer_email || user.email || 'financeiro@redeindoor.local';
    const customerCnpj = order.buyer?.cnpj || null;
    const customerPhone = order.buyer_phone || null;

    const customer = await createOrGetAsaasCustomer({
      name: customerName,
      email: customerEmail,
      cpfCnpj: customerCnpj,
      phone: customerPhone,
      externalReference: order.buyer_company_id || undefined,
    });

    // F. Calcular data de vencimento (3 dias a partir de hoje)
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + 3);
    const dueDateStr = dueDateObj.toISOString().split('T')[0];

    const description = `Pedido de mídia - Rede Indoor Local - ${customerName} em ${order.seller?.trade_name || 'Exibidora'}`;

    // G. Criar Cobrança no Asaas
    const asaasPayment = await createAsaasPayment({
      customerId: customer.id,
      valueCents: order.gross_amount_cents,
      dueDate: dueDateStr,
      description,
      externalReference: order.id, // IDENTIFICADOR CANÔNICO DO PEDIDO
      billingType,
    });

    let pixQrCodeBase64 = null;
    let pixCopyPaste = null;

    // H. Buscar QR Code Pix se aplicável
    try {
      const pixData = await getAsaasPixQrCode(asaasPayment.id);
      if (pixData && pixData.encodedImage) {
        pixQrCodeBase64 = pixData.encodedImage;
        pixCopyPaste = pixData.payload;
      }
    } catch (e) {
      // Pix pode ser obtido posteriormente no pagamento
    }

    // I. Atualizar Pedido no Banco com os links Asaas
    const { error: updateError } = await (supabase.from('ad_offer_orders') as any)
      .update({
        payment_provider: 'asaas',
        asaas_customer_id: customer.id,
        asaas_payment_id: asaasPayment.id,
        asaas_invoice_url: asaasPayment.invoiceUrl || null,
        asaas_bank_slip_url: asaasPayment.bankSlipUrl || null,
        asaas_pix_qr_code: pixQrCodeBase64,
        asaas_pix_copy_paste: pixCopyPaste,
        payment_due_date: dueDateStr,
        payment_status: 'pending_asaas',
        status: 'pending_asaas',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // J. Audit Log
    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      company_id: order.seller_company_id,
      action: 'ASAAS_PAYMENT_CHARGE_CREATED',
      details: {
        order_id: order.id,
        asaas_payment_id: asaasPayment.id,
        gross_amount_cents: order.gross_amount_cents,
      },
    });

    return {
      success: true,
      payment: {
        asaas_payment_id: asaasPayment.id,
        invoiceUrl: asaasPayment.invoiceUrl,
        bankSlipUrl: asaasPayment.bankSlipUrl,
        pixQrCode: pixQrCodeBase64,
        pixCopyPaste,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao comunicar com a API do Asaas.' };
  }
}

/**
 * 2. Obter Status da Cobrança do Pedido
 */
export async function getAsaasPaymentStatusAction(orderId: string) {
  const supabase = createClient();

  const { data: order, error } = await (supabase.from('ad_offer_orders') as any)
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    return { success: false, error: 'Pedido não encontrado.' };
  }

  return {
    success: true,
    orderId: order.id,
    paymentStatus: order.payment_status,
    asaasPaymentId: order.asaas_payment_id,
    invoiceUrl: order.asaas_invoice_url,
    bankSlipUrl: order.asaas_bank_slip_url,
    pixQrCode: order.asaas_pix_qr_code,
    pixCopyPaste: order.asaas_pix_copy_paste,
    paymentConfirmedAt: order.payment_confirmed_at,
  };
}

/**
 * 3. Sincronização Manual de Status da Cobrança no Asaas
 */
export async function syncAsaasPaymentStatusAction(orderId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: order } = await (supabase.from('ad_offer_orders') as any)
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order || !order.asaas_payment_id) {
    return { success: false, error: 'Pedido não encontrado ou sem cobrança Asaas gerada.' };
  }

  try {
    const details = await getAsaasPaymentDetails(order.asaas_payment_id);
    const asaasStatus = details.status; // RECEIVED, CONFIRMED, PENDING, OVERDUE, CANCELLED, REFUNDED
    const asaasValue = parseFloat(details.value || 0);
    const expectedValue = order.gross_amount_cents / 100;

    // Validar externalReference se presente no Asaas
    if (details.externalReference && details.externalReference !== order.id) {
      return { success: false, error: 'Divergência no identificador de referência do pagamento.' };
    }

    // Validar se o valor confere
    if (Math.abs(asaasValue - expectedValue) > 0.01) {
      return { success: false, error: `Divergência de valor: Recebido R$ ${asaasValue}, Esperado R$ ${expectedValue}.` };
    }

    let newStatus = order.payment_status;
    let isConfirmed = false;

    if (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED' || asaasStatus === 'RECEIVED_IN_CASH') {
      newStatus = 'paid_asaas';
      isConfirmed = true;
    } else if (asaasStatus === 'OVERDUE') {
      newStatus = 'overdue';
    } else if (asaasStatus === 'REFUNDED') {
      newStatus = 'refunded';
    } else if (asaasStatus === 'CANCELLED') {
      newStatus = 'cancelled';
    }

    const updates: any = {
      payment_webhook_last_event: `SYNC_${asaasStatus}`,
      updated_at: new Date().toISOString(),
    };

    if (isConfirmed) {
      updates.payment_status = 'paid_asaas';
      updates.status = 'paid_asaas';
      updates.payment_confirmed_at = new Date().toISOString();
    }

    await (supabase.from('ad_offer_orders') as any)
      .update(updates)
      .eq('id', order.id);

    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      company_id: order.seller_company_id,
      action: 'ASAAS_PAYMENT_MANUALLY_SYNCED',
      details: { order_id: order.id, asaas_status: asaasStatus, new_status: newStatus },
    });

    return {
      success: true,
      asaasStatus,
      paymentStatus: newStatus,
      isConfirmed,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao sincronizar cobrança com o Asaas.' };
  }
}

/**
 * 4. Cancelar Cobrança no Asaas
 */
export async function cancelAsaasPaymentAction(orderId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Usuário não autenticado.' };
  }

  const { data: order } = await (supabase.from('ad_offer_orders') as any)
    .select('*')
    .eq('id', orderId)
    .single();

  if (!order || !order.asaas_payment_id) {
    return { success: false, error: 'Pedido sem cobrança Asaas para cancelar.' };
  }

  try {
    await cancelAsaasPayment(order.asaas_payment_id);

    await (supabase.from('ad_offer_orders') as any)
      .update({
        payment_status: 'cancelled',
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    await (supabase.from('audit_logs') as any).insert({
      user_id: user.id,
      company_id: order.seller_company_id,
      action: 'ASAAS_PAYMENT_CANCELLED',
      details: { order_id: order.id, asaas_payment_id: order.asaas_payment_id },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao cancelar cobrança no Asaas.' };
  }
}
