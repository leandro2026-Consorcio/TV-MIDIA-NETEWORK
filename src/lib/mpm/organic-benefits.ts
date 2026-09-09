export interface OrganicBenefitConfig {
  pointsPerBrl: number;
  roundingMode: 'ceil' | 'round' | 'floor';
  commercialInsertionUnitCost: number;
  mediaInsertionsPerBrl: number;
  commercialTvWeight: number;
  windowsMonitorWeight: number;
  residentialScreenWeight: number;
  organicResidentialDeliveryReference: number;
  organicPointsPerValidatedDisplay: number;
  organicRewardMaxPromotionalProgress: number;
  minimumResidentialPrivacyGroupSize: number;
  organicFollowProfileMissionEnabled: boolean;
  expectedRewardVisitConversionRate: number;
  organicReferralPoints: number;
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
  organicResidentialDeliveryReference: 0.05, // Referência própria de entrega residencial: R$ 0,05
  organicPointsPerValidatedDisplay: 0.05, // 0,05 Ponto da Rede por Exibição Validada
  organicRewardMaxPromotionalProgress: 95.0, // Teto máximo server-side de 95%
  minimumResidentialPrivacyGroupSize: 3, // k-anonymity mínimo de 3 telas por bairro residencial
  organicFollowProfileMissionEnabled: false, // Missão "seguir perfil" desativada por padrão
  expectedRewardVisitConversionRate: 0.70, // 70% de conversão estimada em visitas
  organicReferralPoints: 30.0, // +30 Pontos da Rede por indicação de cliente convertida
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

/**
 * Calcula pontos da rede líquidos necessários com aplicação do bônus promocional (com teto estrito de 95%)
 */
export function calculateNetPointsRequired(
  basePoints: number,
  bonusPercentage: number = 0,
  missionsBonusPercentage: number = 0,
  maxProgressCap: number = 95.0
): { netPoints: number; totalBonusApplied: number; promoDiscountPoints: number } {
  const safeBase = Math.max(1, Math.round(basePoints));
  const sumBonus = Math.max(0, bonusPercentage) + Math.max(0, missionsBonusPercentage);
  const totalBonusApplied = Math.min(maxProgressCap, sumBonus);

  if (totalBonusApplied <= 0) {
    return { netPoints: safeBase, totalBonusApplied: 0, promoDiscountPoints: 0 };
  }

  const netPoints = Math.max(1, Math.round(safeBase * (1.0 - (totalBonusApplied / 100.0))));
  const promoDiscountPoints = safeBase - netPoints;

  return { netPoints, totalBonusApplied, promoDiscountPoints };
}

/**
 * Calcula exibições residenciais necessárias para acumular os pontos de um prêmio (taxa 0,05)
 * Padronizado: R$ 79,90 -> 80 pontos base / 0,05 = 1.600 Exibições Validadas (sem bônus).
 * Com bônus de 95%: 4 pontos líquidos / 0,05 = 80 Exibições Validadas.
 * 
 * Se passado valor unitário float (ex.: 79.90), padroniza para os pontos inteiros requeridos (80)
 * para garantir consistência matemática com o requisito efetivo de resgate do participante.
 */
export function calculateResidentialDisplaysNeeded(
  pointsOrUnitValue: number,
  ratePerDisplay: number = 0.05
): number {
  if (pointsOrUnitValue <= 0 || ratePerDisplay <= 0) return 0;
  const points = Math.round(pointsOrUnitValue);
  return Math.round(points / ratePerDisplay);
}

/**
 * Valida se uma quantidade de exibições acumuladas atinge os pontos requeridos do prêmio
 * Exemplo obrigatório:
 * prêmio = 80 pontos (saldo = 0)
 * 1.599 exibições * 0,05 = 79,95 pontos -> NÃO libera (false)
 * 1.600 exibições * 0,05 = 80,00 pontos -> LIBERA (true)
 * 
 * Com bônus 95% (4 pontos):
 * 79 exibições * 0,05 = 3,95 pontos -> NÃO libera (false)
 * 80 exibições * 0,05 = 4,00 pontos -> LIBERA (true)
 */
export function canRedeemWithDisplays(
  displaysCount: number,
  pointsRequired: number,
  ratePerDisplay: number = 0.05,
  currentBalance: number = 0
): { canRedeem: boolean; pointsEarned: number; totalPoints: number } {
  const pointsEarned = Math.round(displaysCount * ratePerDisplay * 100) / 100;
  const totalPoints = Math.round((currentBalance + pointsEarned) * 100) / 100;
  return {
    canRedeem: totalPoints >= pointsRequired,
    pointsEarned,
    totalPoints,
  };
}

/**
 * Calcula estimativa comercial de entregas residenciais (Referência própria R$ 0,05)
 * IMPORTANTE: Segregado da divisão por 0,01! R$ 799,00 / 0,05 = ~15.980 exibições (NÃO 319.600!)
 */
export function calculateResidentialDeliveryTarget(
  promotionalValue: number,
  residentialDeliveryReference: number = 0.05
): number {
  if (promotionalValue <= 0 || residentialDeliveryReference <= 0) return 0;
  return Math.round(promotionalValue / residentialDeliveryReference);
}

/**
 * Valida se um Comprovante de Exibição é elegível para pontuação com base no timezone local da tela
 * Faixa normal: 06:00 até 23:59 (0,05 pts)
 * Faixa madrugada: 00:00 até 05:59 (0,0 pts - anti-farming)
 */
export function isPlaybackEligibleForPoints(
  playedAt: Date | string,
  timezone: string = 'America/Cuiaba',
  dayStart: string = '06:00',
  dayEnd: string = '23:59'
): { eligible: boolean; pointsWeight: number; localTime: string } {
  const date = typeof playedAt === 'string' ? new Date(playedAt) : playedAt;

  // Extrai hora e minuto no timezone especificado
  let localTime = '12:00';
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    localTime = formatter.format(date);
  } catch {
    // Fallback para getHours do date
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    localTime = `${h}:${m}`;
  }

  const isEligible = localTime >= dayStart && localTime <= dayEnd;
  return {
    eligible: isEligible,
    pointsWeight: isEligible ? 0.05 : 0.0,
    localTime,
  };
}

/**
 * Agregação de privacidade residencial: Bairros com menos de N telas (padrão 3) são mascarados
 */
export function filterPrivacyAggregatedResidential(
  groups: Array<{ neighborhood: string; screenCount: number; city: string; validatedDisplays: number }>,
  minimumPrivacyGroupSize: number = 3
) {
  return groups.map((g) => ({
    city: g.city,
    neighborhood: g.screenCount >= minimumPrivacyGroupSize ? g.neighborhood : 'Região Residencial Agrupada',
    screenCount: g.screenCount,
    validatedDisplays: g.validatedDisplays,
    isAggregated: g.screenCount < minimumPrivacyGroupSize,
  }));
}

