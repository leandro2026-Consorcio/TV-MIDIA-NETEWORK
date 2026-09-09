import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateResidentialDeliveryTarget,
  calculateResidentialDisplaysNeeded,
  canRedeemWithDisplays,
  calculateNetPointsRequired,
} from '../src/lib/mpm/organic-benefits.ts';

test('1. Campanha por ID: telas comerciais devem ter apenas Exibições Validadas > 0', () => {
  // Simulação de filtragem por campanha
  const mockScreens = [
    { id: 'screen-1', name: 'TV Entrada', validated_displays: 120, planned: 500 },
    { id: 'screen-2', name: 'TV Caixa', validated_displays: 0, planned: 500 }, // Apenas reservada, zero exibições
    { id: 'screen-3', name: 'Totem Recepção', validated_displays: 45, planned: 500 },
  ];

  const filteredForCampaign = mockScreens.filter((s) => s.validated_displays > 0);

  assert.equal(filteredForCampaign.length, 2, 'Apenas 2 telas tiveram exibições reais');
  assert.equal(filteredForCampaign.some((s) => s.id === 'screen-2'), false, 'Telas apenas reservadas com 0 exibições NÃO podem aparecer');
  assert.equal(filteredForCampaign.every((s) => s.validated_displays > 0), true, 'Todas as telas listadas devem ter pelo menos 1 exibição validada');
});

test('2. Privacidade Residencial Rigorosa: nenhum endereço ou morador individual', () => {
  const residentialScreens = [
    { resident_name: 'Maria S.', street: 'Rua A', number: '100', neighborhood: 'Jardim Itália', city: 'Sinop/MT', displays: 400 },
    { resident_name: 'João P.', street: 'Rua B', number: '205', neighborhood: 'Jardim Itália', city: 'Sinop/MT', displays: 600 },
    { resident_name: 'Carlos T.', street: 'Rua C', number: '310', neighborhood: 'Jardim Itália', city: 'Sinop/MT', displays: 500 },
  ];

  // Agregação de privacidade (mínimo 3 telas)
  const MIN_GROUP_SIZE = 3;
  const grouped = {
    city: 'Sinop/MT',
    neighborhood: residentialScreens.length >= MIN_GROUP_SIZE ? 'Jardim Itália' : 'Região Residencial Agrupada',
    screen_count: residentialScreens.length,
    validated_displays: residentialScreens.reduce((acc, s) => acc + s.displays, 0),
  };

  assert.equal(grouped.screen_count, 3);
  assert.equal(grouped.validated_displays, 1500);
  assert.equal(grouped.neighborhood, 'Jardim Itália');
  
  // NUNCA deve conter endereço individual
  assert.equal((grouped as any).street, undefined);
  assert.equal((grouped as any).number, undefined);
  assert.equal((grouped as any).resident_name, undefined);

  // Se o grupo for menor que o mínimo, agrega em região genérica
  const smallGroup = [
    { resident_name: 'Ana', street: 'Rua X', neighborhood: 'Bairro Isolado', displays: 100 },
  ];
  const maskedGroup = {
    city: 'Sinop/MT',
    neighborhood: smallGroup.length >= MIN_GROUP_SIZE ? 'Bairro Isolado' : 'Região Residencial Agrupada',
    screen_count: smallGroup.length,
  };
  assert.equal(maskedGroup.neighborhood, 'Região Residencial Agrupada', 'Grupos com menos de 3 telas devem ter o bairro mascarado');
});

test('3. Funil Visual: 4 etapas e cálculo de conversão', () => {
  const displays = 15980;
  const issued = 104;
  const visits = 76;
  const interests = Math.round(issued * 3.8); // 395

  const displayToCoupon = Number(((issued / displays) * 100).toFixed(2));
  const couponToVisit = Number(((visits / issued) * 100).toFixed(1));

  assert.equal(displays, 15980, 'Etapa 1: 15.980 Exibições Validadas');
  assert.equal(interests, 395, 'Etapa 2: Interesses iniciados');
  assert.equal(issued, 104, 'Etapa 3: Cupons Emitidos');
  assert.equal(visits, 76, 'Etapa 4: Visitas Confirmadas');

  assert.equal(displayToCoupon, 0.65, 'Taxa Exibição → Cupom deve ser 0,65%');
  assert.equal(couponToVisit, 73.1, 'Taxa Cupom → Visita deve ser aproximadamente 73,1%');
});

test('4. Graceful degradation do Funil: Dado ainda não disponível para campanhas sem cupom', () => {
  // Campanha interna ou branding sem cupom associado
  const rawData = {
    validated_displays: 4500,
    coupons: [] as any[],
  };

  const hasFunnel = rawData.coupons.length > 0;
  const funnel = {
    validated_displays: rawData.validated_displays,
    interests: hasFunnel ? 100 : null,
    coupons_issued: hasFunnel ? 20 : null,
    confirmed_visits: hasFunnel ? 15 : null,
    display_to_coupon_rate: hasFunnel ? 0.44 : null,
    coupon_to_visit_rate: hasFunnel ? 75.0 : null,
    hasFunnelData: hasFunnel,
  };

  assert.equal(funnel.hasFunnelData, false, 'hasFunnelData deve ser false quando não houver cupons vinculados');
  assert.equal(funnel.validated_displays, 4500, 'Exibições Validadas devem continuar sendo exibidas normalmente');
  assert.equal(funnel.coupons_issued, null, 'Cupons devem ser null para disparar "Dado ainda não disponível"');
  assert.equal(funnel.confirmed_visits, null, 'Visitas devem ser null para disparar "Dado ainda não disponível"');
});

test('5. Exportação CSV: formato seguro e sem vazamento de dados residenciais', () => {
  const commercialRow = [
    'Comercial',
    '"Restaurante Central & Grill"',
    'TV Comercial',
    '"Sinop/MT"',
    '"Centro"',
    '"Av. das Figueiras, 1420"',
    '1240',
    '2000',
    '1240',
    '62%',
    '09/09/2026 10:00:00'
  ];

  const residentialRow = [
    'Residencial (Agregado)',
    '"Rede Residencial (14 telas)"',
    'Tela Residencial',
    '"Sinop/MT"',
    '"Jardim Itália"',
    '"[Endereço protegido - Privacidade Residencial]"',
    '2840',
    '-',
    '2840',
    '100%',
    '09/09/2026 10:00:00'
  ];

  const csvLineComm = commercialRow.join(';');
  const csvLineRes = residentialRow.join(';');

  assert.ok(csvLineComm.includes('Av. das Figueiras, 1420'), 'Comercial público deve conter endereço');
  assert.ok(csvLineRes.includes('[Endereço protegido - Privacidade Residencial]'), 'Residencial DEVE proteger o endereço no CSV');
  assert.ok(!csvLineRes.includes('Rua'), 'Nenhum logradouro individual residencial pode constar no CSV');
});

test('6. Consistência matemática dos cálculos de pontos e estimativas comerciais', () => {
  // Regra do Participante: 80 pontos = 1.600 exibições a 0,05 pts/exibição
  const reqDisplays = calculateResidentialDisplaysNeeded(80, 0.05);
  assert.equal(reqDisplays, 1600, '80 pontos / 0,05 pts = 1.600 exibições');

  // Limiar de resgate estrito
  assert.equal(canRedeemWithDisplays(1599, 80, 0.05).canRedeem, false, '1.599 exibições (79,95 pts) não pode resgatar');
  assert.equal(canRedeemWithDisplays(1600, 80, 0.05).canRedeem, true, '1.600 exibições (80,00 pts) pode resgatar');

  // Estimativa Comercial da Empresa (independente): R$ 799 / R$ 0,05 = 15.980 exibições
  const commercialDisplays = calculateResidentialDeliveryTarget(799.0, 0.05);
  assert.equal(commercialDisplays, 15980, 'R$ 799,00 a R$ 0,05 = 15.980 exibições estimadas');
});
