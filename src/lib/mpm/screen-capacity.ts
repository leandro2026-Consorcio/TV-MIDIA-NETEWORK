export const EQUIVALENT_SLOT_SECONDS = 15;

export type DailyWindow = { weekday: number; startMinute: number; endMinute: number; closed?: boolean };
export type CapacityCommitments = { network: number; ownPieces: number; ownMaxSeconds: number; mpmReserve: number; sponsor: number; commercial: number };

export function minutesForPeriod(start: Date, end: Date, schedule: DailyWindow[], exceptions: Record<string, number> = {}) {
  let total = 0;
  const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (day <= last) {
    const key = day.toISOString().slice(0, 10);
    if (exceptions[key] !== undefined) total += Math.max(0, exceptions[key]);
    else total += schedule.filter(w => w.weekday === day.getUTCDay() && !w.closed).reduce((n, w) => n + Math.max(0, w.endMinute - w.startMinute), 0);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return total;
}

export function equivalentSlots(minutes: number, slotSeconds = EQUIVALENT_SLOT_SECONDS) {
  if (minutes < 0 || slotSeconds <= 0) throw new Error('Capacidade inválida.');
  return Math.floor((minutes * 60) / slotSeconds);
}

export function committedSlots(c: CapacityCommitments) {
  return c.network + Math.ceil(c.ownPieces * c.ownMaxSeconds / EQUIVALENT_SLOT_SECONDS) + c.mpmReserve + c.sponsor + c.commercial;
}

export function capacitySummary(minutes: number, c: CapacityCommitments) {
  const technical = equivalentSlots(minutes); const committed = committedSlots(c);
  return { technical, committed, surplus: Math.max(0, technical - committed), deficit: Math.max(0, committed - technical) };
}

export function sellableInventory(nominal: number, sold: number, executableRemaining: number) {
  return Math.max(0, Math.min(nominal - sold, executableRemaining));
}

export function mediaRightRelease(target: number, cycleIndex: number, availabilityPercent: number, advancePercent = 30, performancePercent = 70) {
  if (target < 0 || availabilityPercent < 0 || advancePercent < 0 || performancePercent < 0 || advancePercent + performancePercent > 100) throw new Error('Regra de liberação inválida.');
  if (cycleIndex === 1) return target;
  return Math.min(target, target * advancePercent / 100 + target * performancePercent / 100 * Math.min(availabilityPercent, 100) / 100);
}

export function thermometer(percent: number, green = 90, amber = 75) {
  return percent >= green ? 'healthy' : percent >= amber ? 'attention' : 'risk';
}

export function certifiedCapacity(samples: number[], windowDays = 30, safetyMarginPercent = 15) {
  if (samples.length < windowDays) return null;
  const stable = samples.slice(-windowDays); const average = stable.reduce((a, b) => a + b, 0) / stable.length;
  const min = Math.min(...stable); const safe = Math.floor(average * (1 - safetyMarginPercent / 100));
  return Math.min(safe, min);
}

export type QueueItem = { id: string; bucket: 'sold'|'sponsor'|'network'|'mpm_reserve'|'own'|'news'|'filler'; pending: number; deadline?: number };
const priority = ['sold','sponsor','network','mpm_reserve','own','news','filler'];
export function nextDynamicItem(items: QueueItem[], served: Record<string, number>) {
  const eligible = items.filter(i => i.pending > 0);
  if (!eligible.length) return null;
  return eligible.sort((a,b) => ((a.deadline??Infinity)-(b.deadline??Infinity)) || ((served[a.id]||0)/a.pending-(served[b.id]||0)/b.pending) || priority.indexOf(a.bucket)-priority.indexOf(b.bucket))[0];
}

export function commercialSplit(grossCents: number, feePercent = 10, isSelfPurchase = false) {
  if (grossCents < 0 || feePercent < 0 || feePercent > 100) throw new Error('Venda inválida.');
  if (isSelfPurchase) return { grossCents, platformCents: 0, ownerCents: 0, selfPurchase: true };
  const platformCents = Math.round(grossCents * feePercent / 100);
  return { grossCents, platformCents, ownerCents: grossCents - platformCents, selfPurchase: false };
}

export type DynamicPlaybackBucket = 'sold' | 'sponsor' | 'network' | 'mpm_reserve' | 'own' | 'filler';

export type DynamicPlaybackItem<T = unknown> = {
  value: T;
  bucket: DynamicPlaybackBucket;
  durationSeconds: number;
};

/** Materializa uma janela renovavel; o ciclo permanece como fonte economica. */
export function buildDynamicPlaybackQueue<T>(
  items: DynamicPlaybackItem<T>[],
  targets: Partial<Record<DynamicPlaybackBucket, number>>,
  delivered: Partial<Record<DynamicPlaybackBucket, number>> = {},
  maxItems = 60,
) {
  const byBucket = new Map<DynamicPlaybackBucket, DynamicPlaybackItem<T>[]>();
  for (const item of items) {
    const list = byBucket.get(item.bucket) || [];
    list.push(item);
    byBucket.set(item.bucket, list);
  }

  const used = { ...delivered };
  const cursor: Partial<Record<DynamicPlaybackBucket, number>> = {};
  const result: T[] = [];
  const order: DynamicPlaybackBucket[] = ['sold', 'sponsor', 'network', 'mpm_reserve', 'own', 'filler'];

  while (result.length < Math.max(0, maxItems)) {
    const candidates = order.filter((bucket) => {
      if (!(byBucket.get(bucket)?.length)) return false;
      if (bucket === 'filler') return true;
      return Number(used[bucket] || 0) < Number(targets[bucket] || 0);
    });
    if (!candidates.length) break;

    const contractual = candidates.filter((bucket) => bucket !== 'filler');
    const bucket = contractual.length
      ? contractual.reduce((best, current) => {
          const bestProgress = Number(used[best] || 0) / Math.max(1, Number(targets[best] || 0));
          const currentProgress = Number(used[current] || 0) / Math.max(1, Number(targets[current] || 0));
          return currentProgress < bestProgress ? current : best;
        })
      : 'filler';
    const bucketItems = byBucket.get(bucket)!;
    const index = Number(cursor[bucket] || 0) % bucketItems.length;
    const selected = bucketItems[index];
    result.push(selected.value);
    cursor[bucket] = index + 1;
    used[bucket] = Number(used[bucket] || 0) + Math.max(1, Math.ceil(selected.durationSeconds / EQUIVALENT_SLOT_SECONDS));
  }
  return result;
}
