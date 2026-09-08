'use server';

import { createClient } from '@/lib/supabase/server';

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Usuário não autenticado.' };
  const { data, error } = await (supabase.rpc as any)(name, args);
  return error ? { success: false, error: error.message } : { success: true, data };
}

export async function quoteInventoryAction(input: {
  inventoryId: string; buyerCompanyId: string; insertionQuantity: number; startsAt: string; endsAt: string;
  durationSeconds?: number; format?: string; campaignType?: string; planCode?: string; idempotencyKey: string;
}) {
  return rpc('quote_media_inventory', {
    p_inventory_id: input.inventoryId, p_buyer_company_id: input.buyerCompanyId,
    p_insertion_quantity: input.insertionQuantity, p_starts_at: input.startsAt, p_ends_at: input.endsAt,
    p_duration_seconds: input.durationSeconds ?? null, p_format: input.format ?? null,
    p_campaign_type: input.campaignType ?? null, p_plan_code: input.planCode ?? null, p_idempotency_key: input.idempotencyKey,
  });
}

export async function runCampaignMatchingAction(campaignId: string, requestedInsertions: number, idempotencyKey: string) {
  return rpc('run_campaign_matching', { p_campaign_id: campaignId, p_requested_insertions: requestedInsertions, p_idempotency_key: idempotencyKey });
}

export async function acceptMediaContractAction(quoteId: string, campaignId: string, supplierType: string, supplierId: string, idempotencyKey: string) {
  return rpc('create_media_commercial_contract', { p_quote_id: quoteId, p_campaign_id: campaignId, p_supplier_holder_type: supplierType, p_supplier_holder_id: supplierId, p_idempotency_key: idempotencyKey });
}

export async function consumeEntitlementAction(entitlementPeriodId: string, campaignId: string, quantity: number, idempotencyKey: string) {
  return rpc('consume_inventory_entitlement', { p_entitlement_period_id: entitlementPeriodId, p_campaign_id: campaignId, p_quantity: quantity, p_idempotency_key: idempotencyKey });
}

export async function createEventInventoryAction(input: { eventId: string; name: string; total: number; sponsor: number; commercial: number; idempotencyKey: string }) {
  return rpc('create_event_inventory', { p_event_id: input.eventId, p_inventory_name: input.name, p_total_capacity: input.total, p_sponsor_capacity: input.sponsor, p_commercial_capacity: input.commercial, p_idempotency_key: input.idempotencyKey });
}

export async function simulateCashoutAction(payoutAccountId: string, walletAccountId: string, amount: number, idempotencyKey: string) {
  return rpc('create_cashout_simulation', { p_payout_account_id: payoutAccountId, p_wallet_account_id: walletAccountId, p_amount: amount, p_idempotency_key: idempotencyKey });
}

export async function setSocialChannelParticipationAction(channelId: string, enabled: boolean) {
  return rpc('set_social_channel_participation', { p_channel_id: channelId, p_enabled: enabled });
}
