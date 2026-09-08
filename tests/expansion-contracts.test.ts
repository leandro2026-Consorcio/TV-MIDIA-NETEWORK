import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql=readFileSync(new URL('../supabase/migrations/20260908000290_mpm_expansion_stage1.sql',import.meta.url),'utf8');
const webhook=readFileSync(new URL('../src/app/api/webhooks/asaas/route.ts',import.meta.url),'utf8');

test('planos e regras econômicas são versionados e congelados',()=>{
 assert.match(sql,/expansion_plan_versions/); assert.match(sql,/expansion_commission_rule_versions/); assert.match(sql,/frozen_snapshot/);
 assert.match(sql,/monthly_price_cents\+GREATEST\(0,p_requested_screens-v\.included_screens\)\*v\.extra_screen_price_cents/);
});
test('hierarquia tem dois níveis e attribution da TV é congelada',()=>{
 assert.match(sql,/Terceiro nivel comercial nao permitido/); assert.match(sql,/Attribution de TV ja congelada/); assert.match(sql,/attribution_frozen_at/);
});
test('ativação parcial, reversal e idempotência são protegidos no banco',()=>{
 assert.match(sql,/pending_activation/); assert.match(sql,/available_pending_transfer/); assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/reverse_expansion_payment/); assert.match(sql,/Historico economico imutavel/);
});
test('comissão financeira, entitlement e Crédito MPM permanecem separados',()=>{
 assert.match(sql,/nao representa Credito MPM/); assert.match(sql,/inventory_entitlements/); assert.doesNotMatch(sql,/mpm_grant_credits/);
});
test('webhook Asaas reconhece cobrança de expansão e reversão',()=>{
 assert.match(webhook,/externalReference\?\.startsWith\('expansion:'\)/); assert.match(webhook,/record_expansion_payment/); assert.match(webhook,/reverse_expansion_payment/);
});
test('RLS isola empresa, Creator e Líder; alterações econômicas usam RPC',()=>{
 assert.match(sql,/Subscriptions tenant read/); assert.match(sql,/Commissions beneficiary read/); assert.match(sql,/REVOKE INSERT,UPDATE,DELETE/);
 assert.match(sql,/Acesso exclusivo do Master/);
});
test('onboarding e ajuda respeitam feature flags',()=>{
 assert.match(sql,/expansion_program_v1/); assert.match(sql,/required_feature_flag/); assert.match(sql,/product_help_events/);
});
