export type SplitRule = {
  platformPercent: number;
  creatorPercent: number;
  leaderPercent: number;
};

export type CommissionSplit = {
  platformCents: number;
  creatorCents: number;
  leaderCents: number;
};

export function validateSplitRule(rule: SplitRule) {
  const values = [rule.platformPercent, rule.creatorPercent, rule.leaderPercent];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Percentuais inválidos.');
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total > 100.000001) throw new Error('A distribuição não pode ultrapassar 100%.');
}

/** Distribui centavos sobre o valor real pago. O residual fica com a plataforma. */
export function calculateCommissionSplit(amountCents: number, rule: SplitRule): CommissionSplit {
  validateSplitRule(rule);
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error('Valor deve ser informado em centavos.');
  const creatorCents = Math.round(amountCents * rule.creatorPercent / 100);
  const leaderCents = Math.round(amountCents * rule.leaderPercent / 100);
  const configuredPlatform = Math.round(amountCents * rule.platformPercent / 100);
  const unallocated = Math.max(0, amountCents - creatorCents - leaderCents - configuredPlatform);
  return { platformCents: configuredPlatform + unallocated, creatorCents, leaderCents };
}

export function splitAcrossSlots(totalCents: number, weights: number[]) {
  if (!Number.isInteger(totalCents) || totalCents < 0 || !weights.length || weights.some((weight) => weight <= 0)) {
    throw new Error('Valor ou pesos econômicos inválidos.');
  }
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let allocated = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return totalCents - allocated;
    const share = Math.round(totalCents * weight / weightTotal);
    allocated += share;
    return share;
  });
}

export function calculatePlanTotal(monthlyPriceCents: number, includedScreens: number, requestedScreens: number, extraScreenPriceCents: number) {
  if (![monthlyPriceCents, includedScreens, requestedScreens, extraScreenPriceCents].every(Number.isInteger)) throw new Error('Parâmetros inválidos.');
  if (monthlyPriceCents < 0 || includedScreens < 1 || requestedScreens < 1 || extraScreenPriceCents < 0) throw new Error('Parâmetros inválidos.');
  return monthlyPriceCents + Math.max(0, requestedScreens - includedScreens) * extraScreenPriceCents;
}
