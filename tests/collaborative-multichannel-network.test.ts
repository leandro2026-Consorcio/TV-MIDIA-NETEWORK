import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildOccurrences, campaignBudgetSummary, resolvePublicationMode, validateOwnReward } from '../src/lib/mpm/collaborative-network.ts';

const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260911000380_collaborative_multichannel_network_v1.sql'), 'utf8');

test('uma campanha concentra todas as distribuições no mesmo campaign_id', () => {
  assert.match(migration, /campaign_distribution_rules[\s\S]*campaign_id UUID NOT NULL REFERENCES public\.campaigns/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_collaborative_campaign/);
});

test('playlist referencia campanha sem duplicá-la', () => assert.match(migration, /CREATE TABLE public\.playlist_campaign_items/));
test('variantes preservam a campanha', () => assert.match(migration, /distribution_format TEXT NOT NULL/));

test('Instagram próprio usa aprovação quando automático não está liberado', () => {
  assert.equal(resolvePublicationMode('instagram', 'automatic', { connected: true, publish: true, requiresApproval: true, masterAutomaticEnabled: true }), 'approval');
});
test('Facebook próprio fica manual sem capability', () => assert.equal(resolvePublicationMode('facebook', 'automatic', { connected: true, publish: false, requiresApproval: false, masterAutomaticEnabled: true }), 'manual'));
test('TikTok fica manual enquanto Direct Post não existe', () => assert.equal(resolvePublicationMode('tiktok', 'automatic', { connected: true, publish: false, requiresApproval: false, masterAutomaticEnabled: true }), 'manual'));

test('frequência única gera uma ocorrência', () => assert.equal(buildOccurrences('once', new Date('2026-09-01'), new Date('2026-09-30')).length, 1));
test('frequência diária gera ocorrências no período', () => assert.equal(buildOccurrences('daily', new Date('2026-09-01'), new Date('2026-09-03')).length, 3));
test('frequência semanal preserva o dia', () => assert.equal(buildOccurrences('weekly', new Date('2026-09-01'), new Date('2026-09-15')).length, 3));
test('dias específicos respeitam seleção', () => assert.equal(buildOccurrences('specific_days', new Date('2026-09-01'), new Date('2026-09-07'), [1, 3]).length, 2));

test('canal conectado não implica opt-in', () => assert.match(migration, /participation_enabled BOOLEAN NOT NULL DEFAULT false/));
test('opt-in valida o owner canônico do canal no banco', () => {
  const hardening = fs.readFileSync('supabase/migrations/20260911000381_collaborative_network_security_hardening.sql', 'utf8');
  assert.match(hardening, /channel_owner_type<>NEW\.owner_type OR channel_owner_id<>NEW\.owner_id/);
});
test('opt-in Creator é isolado por owner', () => assert.match(migration, /owner_type TEXT NOT NULL CHECK\(owner_type IN\('company','creator'\)\)/));
test('opt-in Empresa é isolado por owner', () => assert.match(migration, /Channel settings owner manage/));
test('inventário é separado por formato', () => assert.match(migration, /UNIQUE\(social_channel_id,format,period_type,period_start\)/));

test('oferta aberta não exige participante', () => assert.match(migration, /offer_type='open' AND participant_id IS NULL/));
test('oferta direcionada exige participante', () => assert.match(migration, /offer_type='directed' AND participant_type IS NOT NULL AND participant_id IS NOT NULL/));
test('vagas possuem limite total', () => assert.match(migration, /accepted_slots<=total_slots/));
test('última vaga usa lock transacional', () => assert.match(migration, /campaign-offer:[\s\S]*FOR UPDATE/));
test('inventário impede overbooking', () => assert.match(migration, /inv\.reserved_quantity\+inv\.consumed_quantity\+p_quantity>inv\.quantity_limit/));

test('aceite reserva orçamento no ledger canônico', () => assert.match(migration, /public\.mpm_reserve_credits/));
test('falta de saldo é delegada ao core MPM', () => assert.match(migration, /mpm_reserve_credits\(c\.company_id,total/));
test('cancelamento libera reserva canônica', () => assert.match(migration, /public\.mpm_release_reservation/));
test('resumo de orçamento separa estados', () => assert.deepEqual(campaignBudgetSummary(100, [{ amount: 20, status: 'reserved' }, { amount: 30, status: 'consumed' }, { amount: 5, status: 'released' }]), { total: 100, reserved: 20, consumed: 30, reversed: 5, available: 50 }));
test('reserva é idempotente', () => assert.match(migration, /campaign_budget_reservations[\s\S]*idempotency_key TEXT NOT NULL UNIQUE/));

test('publicação validada exige evidência', () => assert.match(migration, /Evidência obrigatória/));
test('liquidação exige publicação real em estado publicado', () => assert.match(migration, /p\.status NOT IN\('published','validation_pending'\)/));
test('settlement é idempotente', () => assert.match(migration, /collab-settlement:/));
test('uma entrega não recompensa duas vezes', () => assert.match(migration, /uq_collab_settlement_acceptance_final/));
test('permanência é registrada na publicação', () => assert.match(migration, /minimum_retention_until TIMESTAMPTZ/));
test('remoção antecipada é auditável', () => assert.match(migration, /removed_at TIMESTAMPTZ/));

test('Crédito MPM e Direito de Mídia usam ledgers separados', () => {
  assert.match(migration, /wallet_reservation_id UUID REFERENCES public\.wallet_reservations/);
  assert.match(migration, /CREATE TABLE public\.media_right_ledger/);
});
test('ledger de Direito de Mídia é imutável', () => assert.match(migration, /trg_media_right_ledger_immutable/));
test('promocional permanece promocional', () => assert.match(migration, /dest_class:=CASE WHEN dest_class='promotional' THEN 'promotional'/));
test('recompensa não é cashout por padrão', () => assert.match(migration, /'cashout_eligible',false/));
test('canal próprio não paga a si mesmo', () => assert.throws(() => validateOwnReward('own_social', 1), /não gera recompensa/));
test('Empresa anunciante não pode remunerar o próprio canal', () => {
  const hardening = fs.readFileSync('supabase/migrations/20260911000381_collaborative_network_security_hardening.sql', 'utf8');
  assert.match(hardening, /Empresa anunciante não pode remunerar o próprio canal/);
});
test('canal colaborativo admite recompensa', () => assert.doesNotThrow(() => validateOwnReward('creator_social', 10)));
test('taxa MPM vem de regra versionada', () => assert.match(migration, /platform_fee_rules[\s\S]*effective_from/));

test('Creator Score existente não é recriado', () => assert.doesNotMatch(migration, /CREATE TABLE public\.creator_score_history/));
test('Score Empresarial é separado e versionado', () => assert.match(migration, /business_media_score_rules[\s\S]*version INTEGER NOT NULL UNIQUE/));
test('score parcial identifica métricas incompletas', () => assert.match(migration, /completeness IN\('complete','partial'\)/));

test('RLS limita campanha ao anunciante', () => assert.match(migration, /Distribution advertiser manage/));
test('RLS limita financeiro aos envolvidos', () => assert.match(migration, /Settlements parties read/));
test('tokens sociais não são copiados para a rede', () => {
  assert.doesNotMatch(migration, /encrypted_access_token/);
  assert.doesNotMatch(migration, /refresh_token/);
});
test('feature flag principal começa desligada', () => assert.match(migration, /collaborative_media_network_enabled','false'/));
test('telas residenciais não são alteradas', () => assert.doesNotMatch(migration, /UPDATE public\.screens/));
test('Proof of Play existente não é reconstruído', () => assert.doesNotMatch(migration, /CREATE TABLE public\.playback_logs/));
test('Social Foundation não é recriada', () => assert.doesNotMatch(migration, /CREATE TABLE public\.social_connections/));
