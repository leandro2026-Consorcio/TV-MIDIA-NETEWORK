import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCommissionSplit, calculatePlanTotal, splitAcrossSlots } from '../src/lib/mpm/expansion-economics.ts';

const first = { platformPercent: 10, creatorPercent: 67.1141, leaderPercent: 22.8859 };
const recurring = { platformPercent: 73.1544, creatorPercent: 16.7785, leaderPercent: 10.0671 };

test('planos usam preço real e adicional sem multiplicar por 149', () => {
  assert.equal(calculatePlanTotal(14900, 1, 1, 5900), 14900);
  assert.equal(calculatePlanTotal(29900, 3, 3, 5900), 29900);
  assert.equal(calculatePlanTotal(44900, 5, 5, 5900), 44900);
  assert.equal(calculatePlanTotal(44900, 5, 6, 5900), 50800);
});

test('primeira cobrança proporcional fecha exatamente em centavos', () => {
  assert.deepEqual(calculateCommissionSplit(14900, first), { platformCents: 1490, creatorCents: 10000, leaderCents: 3410 });
  const split = calculateCommissionSplit(29900, first);
  assert.deepEqual(split, { platformCents: 2990, creatorCents: 20067, leaderCents: 6843 });
  assert.equal(Object.values(split).reduce((sum, value) => sum + value, 0), 29900);
});

test('recorrência proporcional usa valor real do plano', () => {
  assert.deepEqual(calculateCommissionSplit(29900, recurring), { platformCents: 21873, creatorCents: 5017, leaderCents: 3010 });
});

test('ativação parcial libera dois slots e o último absorve residual', () => {
  const slots = splitAcrossSlots(20067, [9967, 9967, 9966]);
  assert.equal(slots[0] + slots[1], 13378);
  assert.equal(slots.reduce((sum, value) => sum + value, 0), 20067);
});

test('percentual acima de 100 é rejeitado', () => {
  assert.throws(() => calculateCommissionSplit(100, { platformPercent: 20, creatorPercent: 70, leaderPercent: 20 }), /100%/);
});
