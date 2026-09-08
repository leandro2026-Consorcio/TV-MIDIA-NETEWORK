import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const crossCompany = readFileSync(join(root, 'supabase/migrations/20260908000100_fix_marketplace_cross_company.sql'), 'utf8');
const inventory = readFileSync(join(root, 'supabase/migrations/20260908000110_core_media_inventory_capacity.sql'), 'utf8');
const playbackAction = readFileSync(join(root, 'src/app/actions/playback-logs.ts'), 'utf8');

test('cross-company preserva campanha interna no próprio tenant', () => {
  assert.match(crossCompany, /campaign_type = 'internal'[\s\S]*v_screen\.company_id <> v_campaign\.company_id/);
  assert.match(crossCompany, /v_media\.company_id <> v_campaign\.company_id/);
});

test('cross-company exige autoridade comercial explícita e pedido pago/aprovado', () => {
  assert.match(crossCompany, /CREATE OR REPLACE FUNCTION public\.is_authorized_commercial_distribution/);
  assert.match(crossCompany, /approval_status = 'approved'/);
  assert.match(crossCompany, /payment_status IN \('paid_manual', 'paid_asaas'\)/);
  assert.match(crossCompany, /c\.company_id = o\.buyer_company_id/);
  assert.match(crossCompany, /s\.company_id = o\.seller_company_id/);
});

test('constraints do pedido aceitam os estados já usados pela integração Asaas', () => {
  for (const status of ['pending_asaas', 'paid_asaas', 'overdue', 'cancelled']) {
    assert.match(crossCompany, new RegExp(`'${status}'`));
  }
  assert.match(crossCompany, /ADD CONSTRAINT ad_offer_orders_status_check/);
  assert.match(crossCompany, /ADD CONSTRAINT ad_offer_orders_payment_status_check/);
});

test('mídia não relacionada e owner_only não são autorizadas', () => {
  assert.match(crossCompany, /m\.company_id = o\.buyer_company_id/);
  assert.match(crossCompany, /NOT COALESCE\(m\.owner_only, FALSE\)/);
  assert.match(crossCompany, /v_media\.id <> v_order\.requested_media_asset_id/);
});

test('Proof of Play usa RPC e service_role continua sujeito à regra de negócio', () => {
  assert.match(playbackAction, /rpc as any\)\('record_playback_log'/);
  assert.doesNotMatch(playbackAction, /from\('playback_logs'\)[\s\S]*\.insert\(/);
  assert.match(crossCompany, /CREATE TRIGGER trg_validate_playback_distribution_authority/);
  assert.match(crossCompany, /public\.is_authorized_commercial_distribution\(cs\.campaign_id, NEW\.screen_id, NEW\.media_asset_id\)/);
});

test('replay de playback é idempotente no banco', () => {
  assert.match(crossCompany, /WHERE idempotency_key = p_idempotency_key/);
  assert.match(crossCompany, /ON CONFLICT \(idempotency_key\)/);
});

test('cancelamento ou perda da autoridade impede nova entrega', () => {
  assert.match(crossCompany, /o\.status = 'converted_to_campaign'/);
  assert.match(crossCompany, /c\.status = 'active'/);
  assert.match(crossCompany, /c\.end_date IS NULL OR c\.end_date >= CURRENT_DATE/);
});

test('RLS comercial concede apenas leituras relacionais específicas ao seller', () => {
  assert.match(crossCompany, /Campaigns - Seller read authorized commercial/);
  assert.match(crossCompany, /CampaignMedia - Seller read authorized commercial/);
  assert.match(crossCompany, /CampaignScreens - Seller read authorized commercial/);
  assert.doesNotMatch(crossCompany, /ON public\.screens FOR SELECT[\s\S]*seller_company_id/);
});

test('inventário é aditivo, começa desligado e não cria crédito MPM', () => {
  for (const key of ['media_inventory_v2', 'inventory_capacity_v2', 'inventory_allocations_v2']) {
    assert.match(inventory, new RegExp(`\\('${key}', 'false'::jsonb`));
  }
  assert.match(inventory, /REFERENCES public\.media_inventory/);
  assert.doesNotMatch(inventory, /CREATE TABLE[^;]*(mpm_credit|mpm_wallet)/i);
  assert.doesNotMatch(inventory, /INSERT INTO public\.(credit_ledger|organic_credit_ledger)/i);
});

test('overbooking e idempotência concorrente usam locks no banco', () => {
  assert.match(inventory, /FROM public\.inventory_capacity_periods WHERE id = NEW\.capacity_period_id FOR UPDATE/);
  assert.match(inventory, /FROM public\.inventory_bucket_policies WHERE id = NEW\.bucket_policy_id FOR UPDATE/);
  assert.match(inventory, /v_period_used \+ NEW\.insertion_quantity > v_period\.theoretical_capacity/);
  assert.match(inventory, /v_bucket_used \+ NEW\.insertion_quantity > v_bucket\.capacity_quantity/);
  assert.match(inventory, /inventory-allocation:' \|\| p_idempotency_key/);
});

test('ownership, preferenciais e Growth são protegidos no banco', () => {
  assert.match(inventory, /CREATE POLICY "MediaInventory - owner read"/);
  assert.match(inventory, /public\.can_access_media_inventory\(p_inventory_id, TRUE\)/);
  assert.match(inventory, /inventory_preferred_limit/);
  assert.match(inventory, /p_bucket_type IN \('partnership', 'mpm_growth'\) AND NOT public\.is_master_admin\(\)/);
  assert.match(inventory, /inventory_growth_enabled/);
});
