export type CapacityCalculationSource = 'manual' | 'estimated' | 'calculated';

export interface CapacityCalculationInput {
  manualCapacity?: number | null;
  activeDays: number;
  activeMinutesPerDay: number;
  averageSlotDurationSeconds: number;
  loopDurationSeconds?: number | null;
  ownContentSecondsPerLoop?: number;
  informativeContentSecondsPerLoop?: number;
  operationalMarginPercent: number;
  downtimeMinutes: number;
  hasMeasuredLoopData?: boolean;
}

export interface CapacityCalculationResult {
  source: CapacityCalculationSource;
  theoreticalCapacity: number;
  commercializableCapacity: number;
  inputs: CapacityCalculationInput;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} deve ser um número não negativo.`);
  return Math.floor(value);
}

export function calculateInventoryCapacity(input: CapacityCalculationInput): CapacityCalculationResult {
  if (input.manualCapacity != null) {
    const manual = nonNegativeInteger(input.manualCapacity, 'manualCapacity');
    return { source: 'manual', theoreticalCapacity: manual, commercializableCapacity: manual, inputs: input };
  }

  const activeDays = nonNegativeInteger(input.activeDays, 'activeDays');
  const activeMinutesPerDay = nonNegativeInteger(input.activeMinutesPerDay, 'activeMinutesPerDay');
  const downtimeMinutes = nonNegativeInteger(input.downtimeMinutes, 'downtimeMinutes');
  if (!Number.isFinite(input.averageSlotDurationSeconds) || input.averageSlotDurationSeconds <= 0) {
    throw new Error('averageSlotDurationSeconds deve ser maior que zero.');
  }
  if (!Number.isFinite(input.operationalMarginPercent) || input.operationalMarginPercent < 0 || input.operationalMarginPercent >= 100) {
    throw new Error('operationalMarginPercent deve estar entre 0 e 100.');
  }

  const activeSeconds = Math.max(0, activeDays * activeMinutesPerDay * 60 - downtimeMinutes * 60);
  const usableSeconds = activeSeconds * (1 - input.operationalMarginPercent / 100);
  const theoreticalCapacity = Math.floor(usableSeconds / input.averageSlotDurationSeconds);

  let commercialRatio = 1;
  if (input.loopDurationSeconds != null) {
    if (!Number.isFinite(input.loopDurationSeconds) || input.loopDurationSeconds <= 0) {
      throw new Error('loopDurationSeconds deve ser maior que zero.');
    }
    const occupied = nonNegativeInteger(input.ownContentSecondsPerLoop ?? 0, 'ownContentSecondsPerLoop')
      + nonNegativeInteger(input.informativeContentSecondsPerLoop ?? 0, 'informativeContentSecondsPerLoop');
    if (occupied > input.loopDurationSeconds) throw new Error('Conteúdo próprio/informativo excede a duração do loop.');
    commercialRatio = (input.loopDurationSeconds - occupied) / input.loopDurationSeconds;
  }

  return {
    source: input.hasMeasuredLoopData ? 'calculated' : 'estimated',
    theoreticalCapacity,
    commercializableCapacity: Math.floor(theoreticalCapacity * commercialRatio),
    inputs: input,
  };
}

export type InventoryBucketType = 'own_use' | 'preferred' | 'partnership' | 'mpm_growth' | 'automatic_pool';

export interface InventoryBucketInput {
  type: InventoryBucketType;
  capacity: number;
}

export function validateInventoryBuckets(theoreticalCapacity: number, buckets: InventoryBucketInput[]): number {
  const capacity = nonNegativeInteger(theoreticalCapacity, 'theoreticalCapacity');
  const seen = new Set<InventoryBucketType>();
  let total = 0;
  for (const bucket of buckets) {
    if (seen.has(bucket.type)) throw new Error(`Bolsão duplicado: ${bucket.type}.`);
    seen.add(bucket.type);
    total += nonNegativeInteger(bucket.capacity, `capacity.${bucket.type}`);
  }
  if (total > capacity) throw new Error('A soma dos bolsões excede a capacidade teórica.');
  return capacity - total;
}

export interface OwnerCapacityReleaseInput {
  enabled: boolean;
  capacity: number;
  consumed: number;
  now: Date;
  periodEnd: Date;
  releaseAfterDay?: number | null;
  releaseLeadDays?: number | null;
}

export function calculateReleasableOwnerCapacity(input: OwnerCapacityReleaseInput): number {
  if (!input.enabled) return 0;
  const capacity = nonNegativeInteger(input.capacity, 'capacity');
  const consumed = nonNegativeInteger(input.consumed, 'consumed');
  if (consumed > capacity) throw new Error('Consumo de uso próprio excede a capacidade reservada.');

  const afterDayReached = input.releaseAfterDay != null && input.now.getUTCDate() >= input.releaseAfterDay;
  const leadReached = input.releaseLeadDays != null
    && input.periodEnd.getTime() - input.now.getTime() <= input.releaseLeadDays * 86_400_000;
  if (!afterDayReached && !leadReached) return 0;
  return capacity - consumed;
}

export interface PreferredParticipantWindow {
  companyId: string;
  startsAt: Date;
  endsAt: Date;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
}

export function validatePreferredParticipantLimit(
  participants: PreferredParticipantWindow[],
  limit: number,
  startsAt: Date,
  endsAt: Date,
): void {
  const configuredLimit = nonNegativeInteger(limit, 'preferredLimit');
  if (endsAt < startsAt) throw new Error('Janela preferencial inválida.');
  const overlapping = participants.filter((participant) =>
    participant.status === 'active'
    && participant.startsAt <= endsAt
    && participant.endsAt >= startsAt
  ).length;
  if (overlapping >= configuredLimit) throw new Error('Limite configurado de preferenciais atingido.');
}

export function isAllocationExpired(expiresAt: Date | null | undefined, now: Date): boolean {
  return expiresAt != null && expiresAt.getTime() <= now.getTime();
}

export function validateGrowthAllocation(input: {
  quantity: number;
  bucketCapacity: number;
  reason?: string | null;
  authorized: boolean;
}): void {
  const quantity = nonNegativeInteger(input.quantity, 'growthQuantity');
  const capacity = nonNegativeInteger(input.bucketCapacity, 'growthBucketCapacity');
  if (!input.authorized) throw new Error('MPM Growth não autorizado.');
  if (!input.reason?.trim()) throw new Error('Motivo de MPM Growth obrigatório.');
  if (quantity > capacity) throw new Error('Reserva Growth excede o bolsão configurado.');
}
