export type PublicationMode = 'manual' | 'approval' | 'automatic';
export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'specific_days' | 'custom_period';

export interface ProviderCapabilities {
  connected: boolean;
  publish: boolean;
  requiresApproval: boolean;
  masterAutomaticEnabled: boolean;
}

export function resolvePublicationMode(
  provider: 'instagram' | 'facebook' | 'tiktok',
  requested: PublicationMode,
  capability: ProviderCapabilities,
): PublicationMode {
  if (!capability.connected || !capability.publish) return 'manual';
  if (requested === 'automatic' && (!capability.masterAutomaticEnabled || capability.requiresApproval)) return 'approval';
  if (provider === 'tiktok' && !capability.publish) return 'manual';
  return requested;
}

export function buildOccurrences(
  recurrence: RecurrenceType,
  startsAt: Date,
  endsAt: Date,
  weekdays: number[] = [],
): Date[] {
  if (endsAt < startsAt) throw new Error('Período inválido.');
  if (recurrence === 'once') return [new Date(startsAt)];
  const result: Date[] = [];
  const cursor = new Date(startsAt);
  while (cursor <= endsAt) {
    const include = recurrence === 'daily'
      || (recurrence === 'weekly' && cursor.getDay() === startsAt.getDay())
      || (recurrence === 'specific_days' && weekdays.includes(cursor.getDay()))
      || recurrence === 'custom_period';
    if (include) result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function campaignBudgetSummary(total: number, reservations: Array<{ amount: number; status: string }>) {
  const reserved = reservations.filter((item) => item.status === 'reserved').reduce((sum, item) => sum + item.amount, 0);
  const consumed = reservations.filter((item) => item.status === 'consumed').reduce((sum, item) => sum + item.amount, 0);
  const reversed = reservations.filter((item) => item.status === 'released' || item.status === 'reversed').reduce((sum, item) => sum + item.amount, 0);
  return { total, reserved, consumed, reversed, available: Math.max(0, total - reserved - consumed) };
}

export function isOwnDistribution(destination: string) {
  return destination === 'own_tv' || destination === 'own_social';
}

export function validateOwnReward(destination: string, reward: number) {
  if (isOwnDistribution(destination) && reward !== 0) throw new Error('Canal próprio não gera recompensa para si mesmo.');
}
