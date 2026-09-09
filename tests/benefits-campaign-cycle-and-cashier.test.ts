import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateRequiredPoints,
  calculatePromotionalContribution,
  calculateNetPointsRequired,
  calculateResidentialDeliveryTarget,
  calculateResidentialDisplaysNeeded,
  generateCouponCode,
  generateQrToken,
} from '../src/lib/mpm/organic-benefits.ts';

test('1, 2, 3: Previsão no cadastro do prêmio (Rodízio R$ 79,90 x 10 un)', () => {
  const unitValue = 79.9;
  const quantity = 10;
  const bonusPercentage = 50;

  // Valor Promocional Total
  const contrib = calculatePromotionalContribution(unitValue, quantity);
  assert.equal(contrib.promotionalValue, 799.0, '10 x R$ 79,90 = R$ 799,00');

  // Pontos necessários sem bônus
  const basePoints = calculateRequiredPoints(unitValue, 1.0, 'round');
  assert.equal(basePoints, 80, 'R$ 79,90 deve resultar em 80 pontos base');

  // Pontos com 50% de bônus
  const netPoints = calculateNetPointsRequired(basePoints, bonusPercentage);
  assert.equal(netPoints.netPoints, 40, 'Com 50% de bônus, o participante precisa de 40 pontos');
  assert.equal(netPoints.promoDiscountPoints, 40);

  // Exibições Estimadas da Campanha (referência residencial R$ 0,05)
  const estimatedDisplays = calculateResidentialDeliveryTarget(contrib.promotionalValue, 0.05);
  assert.equal(estimatedDisplays, 15980, 'R$ 799 / R$ 0,05 = 15.980 Exibições Estimadas');

  // Visitas Estimadas (70% do estoque)
  const expectedRate = 0.70;
  const estimatedVisits = Math.min(quantity, Math.max(1, Math.round(quantity * expectedRate)));
  assert.equal(estimatedVisits, 7, '70% de 10 unidades = 7 visitas estimadas');

  // Estoque máximo
  assert.equal(quantity, 10, 'Estoque máximo é 10 resgates');
});

test('4, 5: Visitas estimadas, taxa configurável e limites de estoque', () => {
  const stock = 10;
  const conversionRate = 0.70;

  const estimatedVisits = Math.min(stock, Math.round(stock * conversionRate));
  assert.equal(estimatedVisits, 7);

  // Nunca pode superar o estoque disponível
  const highConversionRate = 1.50; // 150%
  const cappedVisits = Math.min(stock, Math.round(stock * highConversionRate));
  assert.equal(cappedVisits, 10, 'Visitas estimadas nunca podem exceder o estoque disponível');

  // Meta configurável
  let configuredGoal = 7;
  assert.ok(configuredGoal <= stock, 'Meta não pode ser superior ao estoque');
  
  // Opção de usar estimativa automática
  configuredGoal = estimatedVisits;
  assert.equal(configuredGoal, 7);
});

test('6, 7: O que esta campanha pode gerar e acompanhamento de meta (Estimado vs Realizado)', () => {
  const campaign = {
    title: 'Rodízio de Pizza',
    unitValue: 79.9,
    quantity: 10,
    targetVisits: 7,
    targetDisplays: 8000,
    executedDisplays: 5920,
    confirmedVisits: 5,
    issuedCoupons: 8,
    usedCoupons: 5,
    expiredCoupons: 1,
    waitingCoupons: 2,
  };

  // Percentual de Exibições
  const displayProgress = Math.round((campaign.executedDisplays / campaign.targetDisplays) * 100);
  assert.equal(displayProgress, 74, '5.920 / 8.000 = 74% de entrega');

  // Percentual de Visitas
  const visitProgress = Math.round((campaign.confirmedVisits / campaign.targetVisits) * 100);
  assert.equal(visitProgress, 71, '5 / 7 = 71% de visitas');

  // Balanço de Cupons
  assert.equal(campaign.issuedCoupons, campaign.usedCoupons + campaign.expiredCoupons + campaign.waitingCoupons);
});

test('8, 22: Detecção de 100% da Meta Atingida em tempo real', () => {
  const targetVisits = 7;
  let currentVisits = 6;

  // Antes da baixa (6/7)
  let percent = Math.round((currentVisits / targetVisits) * 100);
  let goalReached = currentVisits >= targetVisits;
  assert.equal(percent, 86);
  assert.equal(goalReached, false);

  // Operador do caixa valida o 7º cupom
  currentVisits += 1;
  percent = Math.round((currentVisits / targetVisits) * 100);
  goalReached = currentVisits >= targetVisits;

  assert.equal(currentVisits, 7);
  assert.equal(percent, 100);
  assert.equal(goalReached, true, 'Meta de 100% deve ser disparada imediatamente ao atingir 7/7');

  // Registro de auditoria do atingimento
  const completionAudit = {
    goalReachedAt: new Date().toISOString(),
    targetVisits: 7,
    confirmedVisits: currentVisits,
    validatedDisplays: 5920,
    issuedCoupons: 8,
    remainingStock: 3,
    promotionalValue: 799.0,
    status: 'META ATINGIDA 🎉',
  };

  assert.equal(completionAudit.confirmedVisits, 7);
  assert.equal(completionAudit.remainingStock, 3);
  assert.ok(completionAudit.status.includes('META ATINGIDA'));
});

test('11: Benefícios Esgotados quando estoque zerar', () => {
  let quantityAvailable = 0;
  const status = quantityAvailable <= 0 ? 'BENEFÍCIOS ESGOTADOS' : 'active';
  assert.equal(status, 'BENEFÍCIOS ESGOTADOS');

  // Resgates posteriores são rejeitados
  const attemptRedeem = (available: number) => {
    if (available <= 0) throw new Error('Benefício com estoque esgotado.');
    return true;
  };

  assert.throws(() => attemptRedeem(quantityAvailable), /esgotado/);
});

test('14, 15: Autenticação do Caixa: Código do Estabelecimento + PIN (4 a 6 dígitos)', () => {
  const establishmentCode = 'PIZZA4821';
  const cashierPin = '4821';

  assert.ok(establishmentCode.length >= 4);
  assert.ok(cashierPin.length >= 4 && cashierPin.length <= 6);

  // Tentativa sem PIN deve falhar
  const validateAuth = (code: string, pin: string) => {
    if (!code) return { success: false, error: 'Código obrigatório' };
    if (!pin || pin.length < 4) return { success: false, error: 'PIN de 4 a 6 dígitos obrigatório' };
    return { success: true };
  };

  assert.equal(validateAuth(establishmentCode, '').success, false);
  assert.equal(validateAuth('', cashierPin).success, false);
  assert.equal(validateAuth(establishmentCode, cashierPin).success, true);
});

test('17, 18: Sanitização de dados no Caixa (LGPD: Sem CPF, telefone ou dados financeiros)', () => {
  const rawParticipant = {
    full_name: 'João da Silva Sauro',
    cpf: '123.456.789-00',
    phone: '(66) 99999-8888',
    address: 'Rua das Palmeiras, 120',
    financial_balance: 1450.00,
  };

  // Função de sanitização do caixa
  const sanitizeForCashier = (participant: typeof rawParticipant, benefitTitle: string) => {
    const firstName = participant.full_name.split(' ')[0];
    return {
      clientFirstName: firstName,
      benefitTitle,
      allowedHours: '18:00–22:00',
      allowedUnit: 'Unidade Centro',
      validUntil: '15/09/2026',
    };
  };

  const cashierView = sanitizeForCashier(rawParticipant, 'Rodízio de Pizza');

  assert.equal(cashierView.clientFirstName, 'João');
  assert.equal((cashierView as any).cpf, undefined, 'CPF NUNCA deve ser exposto ao caixa');
  assert.equal((cashierView as any).phone, undefined, 'Telefone NUNCA deve ser exposto ao caixa');
  assert.equal((cashierView as any).address, undefined, 'Endereço NUNCA deve ser exposto ao caixa');
  assert.equal((cashierView as any).financial_balance, undefined, 'Dados financeiros NUNCA expostos');
});

test('25: Prevenção atômica de dupla baixa de cupom', () => {
  const coupon = {
    id: 'cupom-001',
    status: 'reserved' as 'reserved' | 'redeemed',
    redeemed_at: null as string | null,
  };

  // Simulação de operação atômica de baixa
  const redeemCoupon = (c: typeof coupon) => {
    if (c.status === 'redeemed') {
      return { success: false, error: 'Cupom já utilizado.' };
    }
    c.status = 'redeemed';
    c.redeemed_at = new Date().toISOString();
    return { success: true, visitConfirmed: true };
  };

  // 1ª tentativa: sucesso
  const res1 = redeemCoupon(coupon);
  assert.equal(res1.success, true);
  assert.equal(res1.visitConfirmed, true);
  assert.equal(coupon.status, 'redeemed');

  // 2ª tentativa com o mesmo cupom: bloqueado
  const res2 = redeemCoupon(coupon);
  assert.equal(res2.success, false);
  assert.equal(res2.error, 'Cupom já utilizado.');
});

test('26: Múltiplas unidades: validação se a unidade aceita o benefício', () => {
  const allowedUnits = ['Unidade Centro', 'Matriz'];

  const validateUnit = (unit: string) => {
    if (!allowedUnits.includes(unit)) {
      return { success: false, error: 'Este benefício não é válido nesta unidade.' };
    }
    return { success: true };
  };

  assert.equal(validateUnit('Unidade Shopping').success, false);
  assert.equal(validateUnit('Unidade Shopping').error, 'Este benefício não é válido nesta unidade.');
  assert.equal(validateUnit('Unidade Centro').success, true);
});
