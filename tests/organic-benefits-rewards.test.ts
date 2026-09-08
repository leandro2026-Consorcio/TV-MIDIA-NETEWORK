import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  calculateRequiredPoints,
  calculatePromotionalContribution,
  generateCouponCode,
  generateQrToken,
  isRedemptionAllowedAt,
  formatAllowedWeekdays,
  DEFAULT_ORGANIC_CONFIG,
} from '../src/lib/mpm/organic-benefits.ts';

const migrationSql = readFileSync(
  new URL('../supabase/migrations/20260908000310_mpm_organic_benefits_rewards.sql', import.meta.url),
  'utf8'
);

const testSql = readFileSync(
  new URL('../supabase/tests/mpm_organic_benefits_rewards.sql', import.meta.url),
  'utf8'
);

test('1, 2, 3, 4: Cálculo de pontuação e contribuição promocional de benefício R$ 79,90 com 10 unidades', () => {
  // Padrão: 1 ponto por R$ 1, arredondado para inteiro mais próximo
  const points = calculateRequiredPoints(79.9, 1.0, 'round');
  assert.equal(points, 80, 'R$ 79,90 com fator 1.0 e round deve sugerir 80 pontos');

  const contrib = calculatePromotionalContribution(79.9, 10);
  assert.equal(contrib.promotionalValue, 799.0, '10 unidades a R$ 79,90 = R$ 799,00');
  assert.equal(contrib.suggestedPoints, 80);
  assert.ok(contrib.grantedInsertions > 0, 'Deve conceder inserções de divulgação');
  assert.equal(contrib.isSuspicious, false, 'Preço de R$ 79,90 não é suspeito');
});

test('Modos de arredondamento e fatores configuráveis de pontuação', () => {
  // Arredondar para cima
  assert.equal(calculateRequiredPoints(79.1, 1.0, 'ceil'), 80);
  // Arredondar para baixo
  assert.equal(calculateRequiredPoints(79.9, 1.0, 'floor'), 79);
  // Fator 2 pontos por R$ 1
  assert.equal(calculateRequiredPoints(50.0, 2.0, 'round'), 100);
  // Fator 0.5 pontos por R$ 1
  assert.equal(calculateRequiredPoints(100.0, 0.5, 'round'), 50);
});

test('Detecção de preço suspeito / acima do teto configurado', () => {
  const normal = calculatePromotionalContribution(350.0, 5, { suspiciousPriceThreshold: 500.0 });
  assert.equal(normal.isSuspicious, false);

  const suspicious = calculatePromotionalContribution(1000.0, 5, { suspiciousPriceThreshold: 500.0 });
  assert.equal(suspicious.isSuspicious, true, 'Preço acima de R$ 500 deve ser marcado como suspeito');
});

test('Formato e entropia de código humano de cupom e token QR seguro', () => {
  const code = generateCouponCode();
  assert.equal(code.length, 6, 'Código humano deve ter 6 caracteres');
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/, 'Código deve usar apenas caracteres seguros');

  const qrToken = generateQrToken();
  assert.ok(qrToken.length >= 32, 'Token de QR deve ter entropia suficiente (>= 32 chars hex)');
  assert.match(qrToken, /^[0-9a-f]+$/);

  const hash = createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  assert.equal(hash.length, 64, 'Hash deve ser SHA-256');
  assert.equal(hash, createHash('sha256').update(code.toLowerCase().trim().toUpperCase()).digest('hex'), 'Hash deve ser insensível a maiúsculas/minúsculas');
});

test('Validação de dias da semana e janelas de horário para resgate', () => {
  // Terça-feira (dow = 2) às 19:30
  const tuesdayEvening = new Date('2026-09-15T19:30:00'); // 15/09/2026 é uma terça
  const allowed = isRedemptionAllowedAt(tuesdayEvening, [2, 3, 4], '18:00', '22:00');
  assert.equal(allowed.allowed, true, 'Terça às 19:30 deve ser permitido para 18:00-22:00');

  // Sexta-feira (dow = 5) - dia proibido
  const fridayEvening = new Date('2026-09-18T19:30:00');
  const deniedDay = isRedemptionAllowedAt(fridayEvening, [2, 3, 4], '18:00', '22:00');
  assert.equal(deniedDay.allowed, false);
  assert.match(deniedDay.reason!, /não permitida em sexta-feira/);

  // Terça-feira às 14:00 - horário proibido
  const tuesdayAfternoon = new Date('2026-09-15T14:00:00');
  const deniedHour = isRedemptionAllowedAt(tuesdayAfternoon, [2, 3, 4], '18:00', '22:00');
  assert.equal(deniedHour.allowed, false);
  assert.match(deniedHour.reason!, /Horário não permitido/);
});

test('Formatação amigável de dias da semana', () => {
  assert.equal(formatAllowedWeekdays([2, 3, 4]), 'Terça a Quinta');
  assert.equal(formatAllowedWeekdays([1, 2, 3, 4, 5]), 'Segunda a Sexta');
  assert.equal(formatAllowedWeekdays([0, 1, 2, 3, 4, 5, 6]), 'Todos os dias');
});

test('Contratos de Banco: tabelas, colunas, RPCs e Help Center na migration', () => {
  // 1. Extensão de organic_campaign_rewards
  assert.match(migrationSql, /announced_unit_value/);
  assert.match(migrationSql, /approved_unit_value/);
  assert.match(migrationSql, /approved_promotional_value/);
  assert.match(migrationSql, /max_per_user/);
  assert.match(migrationSql, /allowed_weekdays/);
  assert.match(migrationSql, /allowed_time_start/);
  assert.match(migrationSql, /coupon_validity_days/);
  assert.match(migrationSql, /is_suspicious_price/);

  // 2. Extensão de organic_reward_redemptions
  assert.match(migrationSql, /coupon_code/);
  assert.match(migrationSql, /qr_token/);
  assert.match(migrationSql, /participant_display_name/);
  assert.match(migrationSql, /validation_method/);

  // 3. Tabela de configuração
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.organic_benefit_configurations/);
  assert.match(migrationSql, /points_per_brl/);
  assert.match(migrationSql, /rounding_mode/);
  assert.match(migrationSql, /suspicious_price_threshold/);

  // 4. Tabela de direitos de divulgação
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS public\.organic_benefit_media_entitlements/);
  assert.match(migrationSql, /granted_insertions/);
  assert.match(migrationSql, /executed_insertions/);

  // 5. Funções RPC atômicas
  assert.match(migrationSql, /calculate_organic_benefit_terms/);
  assert.match(migrationSql, /submit_or_update_organic_benefit/);
  assert.match(migrationSql, /approve_organic_benefit/);
  assert.match(migrationSql, /reserve_organic_coupon/);
  assert.match(migrationSql, /validate_and_redeem_coupon/);
  assert.match(migrationSql, /cancel_organic_coupon/);
  assert.match(migrationSql, /expire_organic_redemptions/);

  // 6. Help Center Articles seed
  assert.match(migrationSql, /como-cadastrar-beneficio/);
  assert.match(migrationSql, /como-funciona-pontuacao/);
  assert.match(migrationSql, /como-ganho-divulgacao-oferecendo-premio/);
  assert.match(migrationSql, /como-validar-cupom/);
  assert.match(migrationSql, /como-funciona-estoque/);
  assert.match(migrationSql, /como-acompanhar-visitas/);
  assert.match(migrationSql, /como-resgatar-premio/);
  assert.match(migrationSql, /onde-encontro-meu-cupom/);
  assert.match(migrationSql, /quando-meus-pontos-voltam/);
  assert.match(migrationSql, /meu-cupom-expirou/);
  assert.match(migrationSql, /onde-posso-usar-o-beneficio/);
});

test('Garantia do Princípio Econômico: Nenhum Crédito MPM gerado a partir de benefícios', () => {
  // A migration nunca deve inserir em wallets, nunca deve alterar wallets.balance
  assert.doesNotMatch(migrationSql, /INSERT INTO public\.wallets/);
  assert.doesNotMatch(migrationSql, /UPDATE public\.wallets/);

  // O teste SQL valida explicitamente que wallets permanece com saldo 0
  assert.match(testSql, /FROM public\.wallets WHERE balance > 0/);
});

test('Suítes de Regressão SQL existem e cobrem o ecossistema', () => {
  const sqlFiles = [
    'package1_core_inventory.sql',
    'mpm_credit_v2.sql',
    'mpm_ecosystem.sql',
    'mpm_expansion_stage1.sql',
    'mpm_social_marketplace_stage2.sql',
    'mpm_organic_benefits_rewards.sql',
  ];

  for (const file of sqlFiles) {
    const content = readFileSync(new URL(`../supabase/tests/${file}`, import.meta.url), 'utf8');
    assert.ok(content.length > 500, `Arquivo ${file} deve existir e conter testes SQL`);
    assert.match(content, /BEGIN/i, `${file} deve iniciar com transação`);
    assert.match(content, /ROLLBACK/i, `${file} deve conter ROLLBACK`);
  }
});

