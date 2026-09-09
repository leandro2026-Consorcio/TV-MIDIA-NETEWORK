export interface OrganicBenefitConfig {
  pointsPerBrl: number;
  roundingMode: 'ceil' | 'round' | 'floor';
  commercialInsertionUnitCost: number;
  mediaInsertionsPerBrl: number;
  commercialTvWeight: number;
  windowsMonitorWeight: number;
  residentialScreenWeight: number;
  maxGrantedInsertions: number;
  suspiciousPriceThreshold: number;
  defaultCouponValidityDays: number;
  defaultPointsRefundPolicy: 'refund_on_expire' | 'no_refund';
  defaultStockReturnPolicy: 'return_if_active' | 'no_return';
}

export const DEFAULT_ORGANIC_CONFIG: OrganicBenefitConfig = {
  pointsPerBrl: 1.0,
  roundingMode: 'round',
  commercialInsertionUnitCost: 0.25, // R$ 500 / 2.000 inserções = R$ 0,25
  mediaInsertionsPerBrl: 4.0, // 4.0 inserções por R$ 1,00
  commercialTvWeight: 1.00,
  windowsMonitorWeight: 0.10,
  residentialScreenWeight: 0.01,
  maxGrantedInsertions: 50000,
  suspiciousPriceThreshold: 500.0,
  defaultCouponValidityDays: 7,
  defaultPointsRefundPolicy: 'refund_on_expire',
  defaultStockReturnPolicy: 'return_if_active',
};

/**
 * Calcula a pontuação sugerida para resgate com base no valor unitário e na regra configurada.
 */
export function calculateRequiredPoints(
  unitValue: number,
  pointsPerBrl = DEFAULT_ORGANIC_CONFIG.pointsPerBrl,
  roundingMode: 'ceil' | 'round' | 'floor' = DEFAULT_ORGANIC_CONFIG.roundingMode
): number {
  if (unitValue <= 0) return 1;
  const raw = unitValue * pointsPerBrl;
  let points: number;
  switch (roundingMode) {
    case 'ceil':
      points = Math.ceil(raw);
      break;
    case 'floor':
      points = Math.floor(raw);
      break;
    case 'round':
    default:
      points = Math.round(raw);
      break;
  }
  return Math.max(1, points);
}

/**
 * Calcula a contribuição promocional total e o direito de divulgação gerado em unidades comerciais equivalentes.
 * Referência canônica: 2.000 inserções comerciais ≈ R$ 500 => R$ 0,25 / inserção equivalente (4.0 inserções / R$ 1).
 * Pesos de tela: TV Comercial = 1,00 | Windows Monitor = 0,10 | Residencial = 0,01.
 */
export function calculatePromotionalContribution(
  unitValue: number,
  quantity: number,
  config: Partial<OrganicBenefitConfig> = {}
) {
  const merged = { ...DEFAULT_ORGANIC_CONFIG, ...config };
  const safeQty = Math.max(1, Math.floor(quantity));
  const safeValue = Math.max(0, unitValue);
  const promotionalValue = Number((safeValue * safeQty).toFixed(2));
  // 1. PONTOS DO CONSUMIDOR/PARTICIPANTE (base unitária: R$ 79,90 -> ~80 pontos. Quantidade não multiplica)
  const suggestedPoints = calculateRequiredPoints(safeValue, merged.pointsPerBrl, merged.roundingMode);
  // 2. DIREITO DE DIVULGAÇÃO DA EMPRESA EM UNIDADES COMERCIAIS EQUIVALENTES (R$ 799 / 0,25 = 3.196 unidades)
  const multiplier = merged.mediaInsertionsPerBrl || (merged.commercialInsertionUnitCost > 0 ? 1 / merged.commercialInsertionUnitCost : 4.0);
  const rawInsertions = Math.round(promotionalValue * multiplier);
  const grantedInsertions = Math.min(merged.maxGrantedInsertions, Math.max(1, rawInsertions));
  const isSuspicious = safeValue > merged.suspiciousPriceThreshold;

  return {
    unitValue: safeValue,
    quantity: safeQty,
    promotionalValue,
    suggestedPoints,
    grantedInsertions,
    commercialInsertionUnitCost: merged.commercialInsertionUnitCost,
    commercialTvWeight: merged.commercialTvWeight,
    windowsMonitorWeight: merged.windowsMonitorWeight,
    residentialScreenWeight: merged.residentialScreenWeight,
    isSuspicious,
  };
}

/**
 * Gera um código humano legível para o cupom MPM (6 caracteres alfanuméricos sem confusão visual)
 * Ex.: 7K4P92
 */
export function generateCouponCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(6);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 6; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Gera token opaco seguro para URL / payload de QR Code (sem dados pessoais)
 */
export function generateQrToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 24; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida se um momento (data/hora) é permitido de acordo com os dias e horários configurados
 */
export function isRedemptionAllowedAt(
  now: Date,
  allowedWeekdays: number[] = [0, 1, 2, 3, 4, 5, 6],
  allowedTimeStart?: string | null,
  allowedTimeEnd?: string | null
): { allowed: boolean; reason?: string } {
  const dow = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  if (!allowedWeekdays.includes(dow)) {
    const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    return {
      allowed: false,
      reason: `Utilização não permitida em ${days[dow]}.`,
    };
  }

  if (allowedTimeStart && allowedTimeEnd) {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const [startH, startM] = allowedTimeStart.split(':').map(Number);
    const [endH, endM] = allowedTimeEnd.split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return {
        allowed: false,
        reason: `Horário não permitido: válido entre ${allowedTimeStart} e ${allowedTimeEnd}.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Formata dias da semana em texto amigável
 */
export function formatAllowedWeekdays(weekdays?: number[] | null): string {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) return 'Todos os dias';
  const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.length === 3 && sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4) {
    return 'Terça a Quinta';
  }
  if (sorted.length === 5 && sorted[0] === 1 && sorted[4] === 5) {
    return 'Segunda a Sexta';
  }
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) {
    return 'Sábados e Domingos';
  }
  return sorted.map((d) => names[d]).join(', ');
}
