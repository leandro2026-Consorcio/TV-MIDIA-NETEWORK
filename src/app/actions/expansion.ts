'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAsaasPayment, createOrGetAsaasCustomer, getAsaasPixQrCode } from '@/lib/asaas';

const cents = (value: FormDataEntryValue | null) => Math.round(Number(value || 0) * 100);

export async function contractExpansionPlanAction(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Faça login para contratar.' };
  const companyId = String(formData.get('company_id') || '');
  const planCode = String(formData.get('plan_code') || '');
  const requestedScreens = Number(formData.get('requested_screens') || 0);
  const attributionCode = String(formData.get('attribution_code') || '').trim();
  const billingType = String(formData.get('billing_type') || 'PIX') as 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  const key = crypto.randomUUID();
  const { data: subscriptionId, error } = await (supabase.rpc as any)('create_expansion_subscription', {
    p_company: companyId, p_plan_code: planCode, p_requested_screens: requestedScreens,
    p_attribution_code: attributionCode, p_idempotency_key: key,
  });
  if (error || !subscriptionId) return { success: false, error: error?.message || 'Não foi possível criar a assinatura.' };
  const { data: subscription } = await (supabase.from('company_plan_subscriptions') as any)
    .select('id,contracted_amount_cents,company_id,companies(trade_name,cnpj)')
    .eq('id', subscriptionId).single();
  const intentKey = `first:${subscriptionId}`;
  const { data: paymentId, error: intentError } = await (supabase.rpc as any)('create_expansion_payment_intent', {
    p_subscription: subscriptionId, p_billing_type: billingType, p_idempotency_key: intentKey,
  });
  if (intentError || !paymentId) return { success: false, error: intentError?.message || 'Não foi possível preparar a cobrança.' };
  try {
    const company = Array.isArray(subscription?.companies) ? subscription.companies[0] : subscription?.companies;
    const customer = await createOrGetAsaasCustomer({
      name: company?.trade_name || 'Empresa Mídia por Mídia', email: user.email || 'financeiro@midiapormidia.com.br',
      cpfCnpj: company?.cnpj || undefined, externalReference: companyId,
    });
    const due = new Date(); due.setDate(due.getDate() + 1);
    const payment = await createAsaasPayment({
      customerId: customer.id, valueCents: Number(subscription.contracted_amount_cents), dueDate: due.toISOString().slice(0, 10),
      description: `Plano de expansão MPM - ${requestedScreens} TV(s)`, externalReference: `expansion:${paymentId}`, billingType,
    });
    let pix: any = null;
    if (billingType === 'PIX' || billingType === 'UNDEFINED') {
      try { pix = await getAsaasPixQrCode(payment.id); } catch { /* link da fatura continua disponível */ }
    }
    await (supabase.rpc as any)('attach_expansion_payment_provider', {
      p_payment: paymentId, p_provider_payment_id: payment.id,
      p_metadata: { invoice_url: payment.invoiceUrl || null, bank_slip_url: payment.bankSlipUrl || null, pix_payload: pix?.payload || null },
    });
    revalidatePath('/plans');
    return { success: true, subscriptionId, invoiceUrl: payment.invoiceUrl || payment.bankSlipUrl || null, pixCopyPaste: pix?.payload || null };
  } catch (cause: any) {
    return { success: false, error: cause?.message || 'Assinatura criada, mas a cobrança externa não pôde ser gerada.' };
  }
}

export async function versionExpansionPlanAction(formData: FormData) {
  const supabase = createClient();
  const planId = String(formData.get('plan_id') || '');
  const configuration = {
    name: String(formData.get('name') || ''), description: String(formData.get('description') || ''),
    included_screens: Number(formData.get('included_screens')), monthly_price_cents: cents(formData.get('monthly_price')),
    annual_price_cents: formData.get('annual_price') ? cents(formData.get('annual_price')) : null,
    extra_screen_price_cents: cents(formData.get('extra_screen_price')), max_screens: formData.get('max_screens') ? Number(formData.get('max_screens')) : null,
    days_until_second_charge: Number(formData.get('days_until_second_charge')), grace_days: Number(formData.get('grace_days')),
    company_included_insertions: formData.get('company_included_insertions') ? Number(formData.get('company_included_insertions')) : null,
    creator_insertions_per_screen: formData.get('creator_insertions_per_screen') ? Number(formData.get('creator_insertions_per_screen')) : null,
    preferred_location_limit: Number(formData.get('preferred_location_limit')), creator_entitlement_months: Number(formData.get('creator_entitlement_months')),
    public_available: formData.get('public_available') === 'on', featured: formData.get('featured') === 'on', status: String(formData.get('status') || 'active'),
  };
  const { error } = await (supabase.rpc as any)('admin_version_expansion_plan', { p_plan_id: planId, p_configuration: configuration });
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/mpm/expansion'); revalidatePath('/plans'); revalidatePath('/');
  return { success: true };
}

export async function versionExpansionCommissionAction(formData: FormData) {
  const supabase = createClient();
  const configuration = Object.fromEntries(['first_platform_percent','first_creator_percent','first_leader_percent','recurring_platform_percent','recurring_creator_percent','recurring_leader_percent','duration_months'].map((key) => [key, Number(formData.get(key))]));
  const { error } = await (supabase.rpc as any)('admin_version_expansion_commission_rule', { p_configuration: configuration });
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/mpm/expansion'); return { success: true };
}

export async function inviteCreatorAction(formData: FormData) {
  const supabase = createClient();
  const { error } = await (supabase.rpc as any)('set_expansion_affiliate_relationship', {
    p_leader: String(formData.get('leader_affiliate_id')), p_creator: String(formData.get('creator_affiliate_id')), p_idempotency_key: crypto.randomUUID(),
  });
  if (error) return { success: false, error: error.message };
  revalidatePath('/leader'); return { success: true };
}

export async function activateExpansionSlotAction(formData: FormData) {
  const supabase = createClient();
  const { error } = await (supabase.rpc as any)('activate_expansion_screen_slot', {
    p_slot: String(formData.get('slot_id')), p_screen: String(formData.get('screen_id')),
    p_creator_affiliate: formData.get('creator_affiliate_id') || null, p_idempotency_key: crypto.randomUUID(),
  });
  if (error) return { success: false, error: error.message };
  revalidatePath('/creator'); revalidatePath('/leader'); revalidatePath('/admin/mpm/expansion'); return { success: true };
}
