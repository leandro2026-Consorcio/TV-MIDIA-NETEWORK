/**
 * Cliente REST Server-Side para Comunicação com a API do Asaas v3
 * REDE INDOOR LOCAL - FASE 5A / 5E
 */

const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3';
export const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || '';

async function fetchAsaas(endpoint: string, options: RequestInit = {}) {
  if (!ASAAS_API_KEY) {
    throw new Error('Chave de API do Asaas (ASAAS_API_KEY) não configurada.');
  }

  const url = `${ASAAS_BASE_URL.replace(/\/$/, '')}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.errors?.[0]?.description || data.message || `Erro HTTP ${response.status} na API do Asaas.`;
    throw new Error(errorMsg);
  }

  return data;
}

/**
 * 1. Criar ou Obter Cliente no Asaas
 */
export async function createOrGetAsaasCustomer(payload: {
  name: string;
  email?: string | null;
  cpfCnpj?: string | null;
  phone?: string | null;
  externalReference?: string;
}) {
  if (payload.email) {
    try {
      const searchRes = await fetchAsaas(`/customers?email=${encodeURIComponent(payload.email)}`);
      if (searchRes.data && searchRes.data.length > 0) {
        return searchRes.data[0];
      }
    } catch (e) {
      // prosseguir para criação se não encontrar
    }
  }

  const customerData = await fetchAsaas('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      email: payload.email || undefined,
      cpfCnpj: payload.cpfCnpj ? payload.cpfCnpj.replace(/\D/g, '') : undefined,
      phone: payload.phone || undefined,
      externalReference: payload.externalReference || undefined,
      notificationDisabled: false,
    }),
  });

  return customerData;
}

/**
 * 2. Criar Cobrança no Asaas (Pix, Boleto ou Cartão / Fatura)
 */
export async function createAsaasPayment(payload: {
  customerId: string;
  valueCents: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  externalReference: string; // ad_offer_order_id
  billingType?: 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD';
}) {
  const value = (payload.valueCents / 100).toFixed(2);

  const paymentData = await fetchAsaas('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: payload.customerId,
      billingType: payload.billingType || 'UNDEFINED',
      value: parseFloat(value),
      dueDate: payload.dueDate,
      description: payload.description,
      externalReference: payload.externalReference,
      postalService: false,
    }),
  });

  return paymentData;
}

/**
 * 3. Consultar Detalhes da Cobrança no Asaas
 */
export async function getAsaasPaymentDetails(paymentId: string) {
  return await fetchAsaas(`/payments/${paymentId}`);
}

/**
 * 4. Obter QR Code e Chave Copia e Cola Pix
 */
export async function getAsaasPixQrCode(paymentId: string) {
  return await fetchAsaas(`/payments/${paymentId}/pixQrCode`);
}

/**
 * 5. Cancelar Cobrança no Asaas
 */
export async function cancelAsaasPayment(paymentId: string) {
  return await fetchAsaas(`/payments/${paymentId}`, {
    method: 'DELETE',
  });
}

/**
 * 6. Transferência Server-Side para Subconta / Carteira Asaas (Fase 5E)
 */
export async function transferToAsaasSubAccount(payload: {
  walletId: string;
  valueCents: number;
  idempotencyKey: string;
}) {
  const value = (payload.valueCents / 100).toFixed(2);

  try {
    const transferData = await fetchAsaas('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        walletId: payload.walletId,
        value: parseFloat(value),
      }),
    });
    return { success: true, data: transferData };
  } catch (err: any) {
    // Trata erro de comunicação ou homologação
    return { success: false, error: err.message };
  }
}

/**
 * 7. Criar Assinatura Recorrente no Asaas (Planos Mensais 1 a 5 TVs)
 */
export async function createAsaasSubscription(payload: {
  customerId: string;
  valueCents: number;
  nextDueDate: string; // YYYY-MM-DD (ex: após 60 dias grátis ou imediato)
  description: string;
  externalReference: string; // ex: company_id + plan_id
  billingType?: 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  cycle?: 'MONTHLY' | 'YEARLY';
}) {
  const value = (payload.valueCents / 100).toFixed(2);

  const subscriptionData = await fetchAsaas('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      customer: payload.customerId,
      billingType: payload.billingType || 'UNDEFINED',
      value: parseFloat(value),
      nextDueDate: payload.nextDueDate,
      cycle: payload.cycle || 'MONTHLY',
      description: payload.description,
      externalReference: payload.externalReference,
    }),
  });

  return subscriptionData;
}

/**
 * 8. Criar Link de Pagamento / Checkout Direto no Asaas para Plano
 */
export async function createAsaasPaymentLink(payload: {
  name: string;
  valueCents: number;
  description: string;
  externalReference: string;
  billingType?: 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD';
}) {
  const value = (payload.valueCents / 100).toFixed(2);

  const paymentLinkData = await fetchAsaas('/paymentLinks', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      billingType: payload.billingType || 'UNDEFINED',
      chargeType: 'RECURRENT',
      subscriptionCycle: 'MONTHLY',
      value: parseFloat(value),
      description: payload.description,
      externalReference: payload.externalReference,
    }),
  });

  return paymentLinkData;
}

