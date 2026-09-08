import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateInventoryCapacity,
  calculateReleasableOwnerCapacity,
  isAllocationExpired,
  validateGrowthAllocation,
  validateInventoryBuckets,
  validatePreferredParticipantLimit,
} from '../src/lib/inventory/capacity.ts';

test('capacidade manual não inventa precisão', () => {
  const result = calculateInventoryCapacity({
    manualCapacity: 12_345,
    activeDays: 0,
    activeMinutesPerDay: 0,
    averageSlotDurationSeconds: 10,
    operationalMarginPercent: 0,
    downtimeMinutes: 0,
  });
  assert.equal(result.source, 'manual');
  assert.equal(result.theoreticalCapacity, 12_345);
});

test('capacidade calculada desconta downtime, margem, conteúdo próprio e informativo', () => {
  const result = calculateInventoryCapacity({
    activeDays: 1,
    activeMinutesPerDay: 60,
    averageSlotDurationSeconds: 10,
    loopDurationSeconds: 100,
    ownContentSecondsPerLoop: 20,
    informativeContentSecondsPerLoop: 10,
    operationalMarginPercent: 10,
    downtimeMinutes: 10,
    hasMeasuredLoopData: true,
  });
  assert.equal(result.source, 'calculated');
  assert.equal(result.theoreticalCapacity, 270);
  assert.equal(result.commercializableCapacity, 189);
});

test('capacidade estimada é identificada quando não há medição de loop', () => {
  const result = calculateInventoryCapacity({
    activeDays: 30,
    activeMinutesPerDay: 60,
    averageSlotDurationSeconds: 15,
    operationalMarginPercent: 5,
    downtimeMinutes: 0,
  });
  assert.equal(result.source, 'estimated');
});

test('soma de bolsões aceita limite exato e devolve sobra', () => {
  assert.equal(validateInventoryBuckets(30_000, [
    { type: 'own_use', capacity: 8_000 },
    { type: 'preferred', capacity: 6_000 },
    { type: 'partnership', capacity: 2_000 },
    { type: 'mpm_growth', capacity: 1_000 },
    { type: 'automatic_pool', capacity: 13_000 },
  ]), 0);
  assert.equal(validateInventoryBuckets(100, [{ type: 'own_use', capacity: 20 }]), 80);
});

test('soma de bolsões rejeita overbooking e tipos duplicados', () => {
  assert.throws(() => validateInventoryBuckets(10, [{ type: 'own_use', capacity: 11 }]), /excede/);
  assert.throws(() => validateInventoryBuckets(10, [
    { type: 'own_use', capacity: 3 },
    { type: 'own_use', capacity: 3 },
  ]), /duplicado/);
});

test('uso próprio só libera ocioso depois da janela configurada', () => {
  const base = {
    enabled: true,
    capacity: 2_000,
    consumed: 500,
    periodEnd: new Date('2026-09-30T23:59:59Z'),
    releaseAfterDay: 15,
    releaseLeadDays: null,
  };
  assert.equal(calculateReleasableOwnerCapacity({ ...base, now: new Date('2026-09-14T12:00:00Z') }), 0);
  assert.equal(calculateReleasableOwnerCapacity({ ...base, now: new Date('2026-09-15T12:00:00Z') }), 1_500);
});

test('uso próprio pode liberar por antecedência e respeita expiração total', () => {
  assert.equal(calculateReleasableOwnerCapacity({
    enabled: true,
    capacity: 1_000,
    consumed: 1_000,
    now: new Date('2026-09-25T00:00:00Z'),
    periodEnd: new Date('2026-09-30T00:00:00Z'),
    releaseLeadDays: 7,
  }), 0);
});

test('expiração de reserva respeita o instante configurado', () => {
  const now = new Date('2026-09-20T12:00:00Z');
  assert.equal(isAllocationExpired(new Date('2026-09-20T11:59:59Z'), now), true);
  assert.equal(isAllocationExpired(new Date('2026-09-20T12:00:01Z'), now), false);
  assert.equal(isAllocationExpired(null, now), false);
});

test('limite de preferenciais considera somente janelas ativas sobrepostas', () => {
  const participants = [
    { companyId: 'a', startsAt: new Date('2026-09-01'), endsAt: new Date('2026-09-30'), status: 'active' as const },
    { companyId: 'b', startsAt: new Date('2026-09-01'), endsAt: new Date('2026-09-30'), status: 'paused' as const },
  ];
  assert.doesNotThrow(() => validatePreferredParticipantLimit(
    participants, 2, new Date('2026-09-15'), new Date('2026-09-20'),
  ));
  assert.throws(() => validatePreferredParticipantLimit(
    participants, 1, new Date('2026-09-15'), new Date('2026-09-20'),
  ), /Limite/);
});

test('Growth exige autorização, motivo e respeita o bolsão', () => {
  assert.doesNotThrow(() => validateGrowthAllocation({
    quantity: 500, bucketCapacity: 1_000, reason: 'demo regional', authorized: true,
  }));
  assert.throws(() => validateGrowthAllocation({
    quantity: 1, bucketCapacity: 1_000, reason: 'demo', authorized: false,
  }), /não autorizado/);
  assert.throws(() => validateGrowthAllocation({
    quantity: 1_001, bucketCapacity: 1_000, reason: 'demo', authorized: true,
  }), /excede/);
});
