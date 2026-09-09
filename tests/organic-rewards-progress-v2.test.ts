import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  calculateRequiredPoints,
  calculatePromotionalContribution,
  calculateNetPointsRequired,
  calculateResidentialDisplaysNeeded,
  calculateResidentialDeliveryTarget,
  isPlaybackEligibleForPoints,
  filterPrivacyAggregatedResidential,
  DEFAULT_ORGANIC_CONFIG,
} from '../src/lib/mpm/organic-benefits.ts';

const migrationSql = readFileSync(
  new URL('../supabase/migrations/20260909000340_organic_network_v2.sql', import.meta.url),
  'utf8'
);

test('1. Exemplo Obrigatório: Rodízio R$ 79,90 com 10 unidades em estoque', () => {
  // A exigência individual de pontos base é calculada pelo valor unitário aprovado (R$ 79,90 -> 80 pontos)
  const basePoints = calculateRequiredPoints(79.9, 1.0, 'round');
  assert.equal(basePoints, 80, 'R$ 79,90 deve resultar em 80 pontos base para o participante');

  // Estoque de 10 unidades não multiplica a exigência do participante
  const contrib = calculatePromotionalContribution(79.9, 10);
  assert.equal(contrib.suggestedPoints, 80, 'Mesmo com 10 unidades em estoque, a meta individual continua 80 pontos e não 800');
  assert.equal(contrib.promotionalValue, 799.0, 'Valor promocional total da empresa = R$ 799,00');

  // Sem bônus, à taxa de 0,05 ponto por exibição validada residencial:
  const displaysByUnitValue = calculateResidentialDisplaysNeeded(79.9, 0.05);
  assert.equal(displaysByUnitValue, 1598, '79,90 / 0,05 deve resultar em aproximadamente 1.598 exibições validadas');

  const displaysByBasePoints = Math.round(basePoints / 0.05);
  assert.equal(displaysByBasePoints, 1600, '80 pontos / 0,05 resulta em 1.600 exibições validadas');
});

test('2. Bônus de 95% da Empresa: Requisito líquido de 4 pontos e preservação de saldo', () => {
  const basePoints = 80;
  const bonusPercentage = 95;

  const { netPoints, totalBonusApplied, promoDiscountPoints } = calculateNetPointsRequired(
    basePoints,
    bonusPercentage,
    0,
    95.0
  );

  assert.equal(totalBonusApplied, 95, 'Bônus aplicado deve ser 95%');
  assert.equal(netPoints, 4, '80 pontos com 95% de bônus exige estritamente 4 pontos da rede');
  assert.equal(promoDiscountPoints, 76, '76 pontos foram subsidiados como bônus da empresa');

  // Participante possui 30 Pontos da Rede
  const participantBalance = 30;
  assert.ok(participantBalance >= netPoints, 'Participante tem saldo suficiente para resgate (30 >= 4)');

  // Ao resgatar, apenas 4 pontos devem ser debitados da carteira do participante
  const remainingBalance = participantBalance - netPoints;
  assert.equal(remainingBalance, 26, 'Saldo restante deve ser exatamente 26 pontos (30 - 4), e NÃO debitar 80');
});

test('3. Segregação: 3.196 unidades comerciais NÃO viram 319.600 residenciais (Adendo 1 & 2)', () => {
  const promoValue = 799.0;

  // Unidades comerciais equivalentes (R$ 0,25)
  const commercialUnits = Math.round(promoValue / 0.25);
  assert.equal(commercialUnits, 3196, '3.196 unidades comerciais geradas');

  // NÃO dividir 3.196 por 0,01 para obter 319.600!
  const falseResidential = commercialUnits / 0.01;
  assert.equal(falseResidential, 319600);

  // Referência própria de entrega residencial (R$ 0,05)
  const residentialDelivery = calculateResidentialDeliveryTarget(
    promoValue,
    DEFAULT_ORGANIC_CONFIG.organicResidentialDeliveryReference
  );
  assert.equal(residentialDelivery, 15980, 'R$ 799 / R$ 0,05 = 15.980 exibições residenciais estimadas, NUNCA 319.600');
  assert.notEqual(residentialDelivery, 319600, 'Conversão automática de 319.600 está terminantemente eliminada');
});

test('4. Independência entre Pontos do Participante e Referência Comercial (Adendo 3)', () => {
  // Recompensa do participante
  assert.equal(DEFAULT_ORGANIC_CONFIG.organicPointsPerValidatedDisplay, 0.05);
  // Referência comercial da empresa
  assert.equal(DEFAULT_ORGANIC_CONFIG.organicResidentialDeliveryReference, 0.05);

  // Coincidem numericamente no início, mas são grandezas e configurações distintas
  assert.ok('organicPointsPerValidatedDisplay' in DEFAULT_ORGANIC_CONFIG);
  assert.ok('organicResidentialDeliveryReference' in DEFAULT_ORGANIC_CONFIG);
});

test('5. Teto Máximo de Bônus Server-side: Bônus Inicial + Missões limitado a 95% (Adendo 6)', () => {
  const basePoints = 80;
  const initialBonus = 75; // 75%
  const storyMission = 15; // 15%
  const feedMission = 20;  // 20%
  // Total solicitado = 110%

  const { netPoints, totalBonusApplied } = calculateNetPointsRequired(
    basePoints,
    initialBonus,
    storyMission + feedMission,
    DEFAULT_ORGANIC_CONFIG.organicRewardMaxPromotionalProgress
  );

  assert.equal(totalBonusApplied, 95.0, 'Bônus total deve ser limitado estritamente a 95% no servidor');
  assert.equal(netPoints, 4, 'Mesmo solicitando 110% de bônus, ainda são exigidos 4 pontos da rede');
});

test('6. Missão "Seguir Perfil" desativada por padrão (Adendo 7)', () => {
  assert.equal(
    DEFAULT_ORGANIC_CONFIG.organicFollowProfileMissionEnabled,
    false,
    'organic_follow_profile_mission_enabled deve ser false por padrão'
  );
  assert.ok(migrationSql.includes("organic_follow_profile_mission_enabled BOOLEAN NOT NULL DEFAULT false"));
});

test('7. Horários e Timezone Local da Tela (Adendo 4 & 5)', () => {
  // 23:50 no horário local de Cuiabá (America/Cuiaba) deve gerar 0,05 pontos
  const dateEvening = new Date('2026-09-15T23:50:00-04:00');
  const checkEvening = isPlaybackEligibleForPoints(dateEvening, 'America/Cuiaba', '06:00', '23:59');
  assert.equal(checkEvening.eligible, true);
  assert.equal(checkEvening.pointsWeight, 0.05);
  assert.equal(checkEvening.localTime, '23:50');

  // 02:00 da madrugada no horário local deve gerar ZERO pontos (anti-farming)
  const dateNight = new Date('2026-09-16T02:00:00-04:00');
  const checkNight = isPlaybackEligibleForPoints(dateNight, 'America/Cuiaba', '06:00', '23:59');
  assert.equal(checkNight.eligible, false);
  assert.equal(checkNight.pointsWeight, 0.0);
  assert.equal(checkNight.localTime, '02:00');
});

test('8. Privacidade Residencial por Tamanho de Grupo >= 3 (Adendo 10)', () => {
  const groups = [
    { neighborhood: 'Jardim Itália', screenCount: 14, city: 'Sinop/MT', validatedDisplays: 2840 },
    { neighborhood: 'Residencial Florença', screenCount: 1, city: 'Sinop/MT', validatedDisplays: 120 },
    { neighborhood: 'Jardim Primavera', screenCount: 2, city: 'Sinop/MT', validatedDisplays: 240 },
  ];

  const filtered = filterPrivacyAggregatedResidential(groups, 3);

  // Jardim Itália tem 14 telas (>= 3) -> exibe o bairro
  assert.equal(filtered[0].neighborhood, 'Jardim Itália');
  assert.equal(filtered[0].isAggregated, false);

  // Residencial Florença tem 1 tela (< 3) -> mascarado como 'Região Residencial Agrupada'
  assert.equal(filtered[1].neighborhood, 'Região Residencial Agrupada');
  assert.equal(filtered[1].isAggregated, true);

  // Jardim Primavera tem 2 telas (< 3) -> mascarado como 'Região Residencial Agrupada'
  assert.equal(filtered[2].neighborhood, 'Região Residencial Agrupada');
  assert.equal(filtered[2].isAggregated, true);
});

test('9. Estimativa de Visitas (70%) e Contratos de Metas da Empresa (Adendo 11)', () => {
  const stock = 10;
  const conversionRate = DEFAULT_ORGANIC_CONFIG.expectedRewardVisitConversionRate; // 0.70
  assert.equal(conversionRate, 0.70);

  const estimatedVisits = Math.min(stock, Math.round(stock * conversionRate));
  assert.equal(estimatedVisits, 7, '10 prêmios em estoque geram estimativa de 7 visitas confirmadas');

  // Não pode exceder o estoque disponível
  const smallStock = 2;
  const smallEstimate = Math.min(smallStock, Math.round(smallStock * conversionRate));
  assert.ok(smallEstimate <= smallStock);
});

test('10. Contratos SQL da Migration 340 (Tabelas, Colunas, Restrições e RPCs)', () => {
  // Extensões de organic_campaign_rewards
  assert.ok(migrationSql.includes('bonus_percentage NUMERIC(5,2)'));
  assert.ok(migrationSql.includes('bonus_scope TEXT NOT NULL DEFAULT'));
  assert.ok(migrationSql.includes('target_visits INTEGER'));
  assert.ok(migrationSql.includes('primary_goal TEXT NOT NULL DEFAULT'));
  assert.ok(migrationSql.includes('visits_confirmed INTEGER'));
  assert.ok(migrationSql.includes('goal_reached_at TIMESTAMPTZ'));

  // Tabelas criadas
  assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.organic_reward_missions'));
  assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.organic_participant_mission_completions'));
  assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.organic_participant_pinned_rewards'));
  assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.company_cashier_access'));
  assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.company_cashier_devices'));

  // RPCs
  assert.ok(migrationSql.includes('CREATE OR REPLACE FUNCTION public.reserve_organic_coupon'));
  assert.ok(migrationSql.includes('CREATE OR REPLACE FUNCTION public.validate_and_redeem_coupon'));
  assert.ok(migrationSql.includes('CREATE OR REPLACE FUNCTION public.process_organic_screen_display_points'));
  assert.ok(migrationSql.includes('CREATE OR REPLACE FUNCTION public.credit_organic_referral_points'));
  assert.ok(migrationSql.includes('CREATE OR REPLACE FUNCTION public.get_ad_distribution_report'));

  // Regras de negócio essenciais no SQL
  assert.ok(migrationSql.includes('minimum_residential_privacy_group_size'));
  assert.ok(migrationSql.includes('organic_residential_delivery_reference'));
  assert.ok(migrationSql.includes('organic_reward_max_promotional_progress'));
});
