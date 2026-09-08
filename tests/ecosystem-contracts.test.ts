import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = [
  '20260908000160_mpm_ecosystem_foundation.sql','20260908000170_mpm_ecosystem_functions.sql',
  '20260908000200_matching_spend_growth_policies.sql','20260908000210_omnichannel_contracts_and_proofs.sql',
  '20260908000220_commissions_reconciliation_jobs.sql','20260908000230_sensitive_columns_and_admin_dashboard.sql',
].map((name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')).join('\n');

test('matching é determinístico e materializado, sem random puro', () => {
  assert.match(migration, /matching_decisions/); assert.match(migration, /score DESC,mc\.inventory_id/); assert.doesNotMatch(migration, /random\s*\(/i);
});
test('matching cobre região, categoria, concorrência, orçamento e frequência', () => {
  for (const contract of ['city_mismatch','state_mismatch','category_blocked','competitor_segment','budget_exceeded','frequency_cap']) assert.match(migration, new RegExp(contract));
});
test('preço é versionado e congelado na cotação', () => {
  assert.match(migration, /UNIQUE\(code,version\)/); assert.match(migration, /media_price_quotes/); assert.match(migration, /unit_price_credits/);
});
test('entitlement não é tratado como crédito', () => {
  assert.match(migration, /inventory_entitlements/); assert.match(migration, /quota_usage/); assert.match(migration, /entitlement_usage/);
});
test('social e creator reutilizam media_inventory e prova validada', () => {
  assert.match(migration, /sync_social_channel_inventory/); assert.match(migration, /proof_of_publication/); assert.match(migration, /record_validated_delivery_proof/);
});
test('cash-out permanece simulado e desligado', () => {
  assert.match(migration, /'cashout_enabled','false'/); assert.match(migration, /simulation_only/); assert.match(migration, /cashout_feature_disabled/);
});
test('saldos legados são reconciliados sem conversão', () => {
  assert.match(migration, /legacy_balance_reconciliations/); assert.match(migration, /'converted',false/); assert.match(migration, /factor_preserved/);
});
test('segredos sociais e payout não são selecionáveis por clientes', () => {
  assert.match(migration, /REVOKE SELECT ON public\.social_connections/); assert.match(migration, /REVOKE SELECT ON public\.payout_methods/);
});
