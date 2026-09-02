export const PLAN_PRICE_KEYS = ['1-tv', '2-tvs', '3-tvs', '4-tvs', '5-tvs', 'additional-tv'] as const;

export type PlanPriceKey = (typeof PLAN_PRICE_KEYS)[number];
export type PlanPrices = Record<PlanPriceKey, number>;

export const DEFAULT_PLAN_PRICES: PlanPrices = {
  '1-tv': 2990,
  '2-tvs': 4990,
  '3-tvs': 6990,
  '4-tvs': 8990,
  '5-tvs': 9990,
  'additional-tv': 1499,
};

export function normalizePlanPrices(value: unknown): PlanPrices {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};

  return PLAN_PRICE_KEYS.reduce((prices, key) => {
    const parsed = Number(input[key]);
    prices[key] = Number.isFinite(parsed) && parsed >= 0
      ? Math.round(parsed)
      : DEFAULT_PLAN_PRICES[key];
    return prices;
  }, {} as PlanPrices);
}

export function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
