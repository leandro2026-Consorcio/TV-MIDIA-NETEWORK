export const PLAYER_WATCHDOG_INTERVAL_MS = 5_000;
export const PLAYER_STALL_THRESHOLD_MS = 15_000;
export const PLAYER_ASSET_COOLDOWN_MS = 2 * 60_000;
export const PLAYER_MAX_RECOVERY_ATTEMPTS = 3;

export interface ContinuityQueueItem {
  id: string;
  media_id?: string | null;
  content_id?: string | null;
}

export type RecoveryStep = 'play' | 'reload' | 'skip';

export function playbackAssetKey(item: ContinuityQueueItem): string {
  return item.media_id || item.content_id || item.id;
}

export function recoveryStepForAttempt(attempt: number): RecoveryStep {
  if (attempt <= 1) return 'play';
  if (attempt < PLAYER_MAX_RECOVERY_ATTEMPTS) return 'reload';
  return 'skip';
}

export function isItemTemporarilyBlocked(
  item: ContinuityQueueItem,
  blockedUntil: ReadonlyMap<string, number>,
  now = Date.now()
): boolean {
  return (blockedUntil.get(playbackAssetKey(item)) || 0) > now;
}

export function playableQueueItems<T extends ContinuityQueueItem>(
  items: readonly T[],
  blockedUntil: ReadonlyMap<string, number>,
  now = Date.now()
): T[] {
  return items.filter((item) => !isItemTemporarilyBlocked(item, blockedUntil, now));
}

export interface QueueTransition {
  index: number | null;
  wrapped: boolean;
}

/**
 * Seleciona a próxima execução elegível e sempre faz wrap-around. O próprio
 * item volta a ser selecionado quando é o único item saudável da fila.
 */
export function nextPlayableIndex<T extends ContinuityQueueItem>(
  items: readonly T[],
  currentIndex: number,
  blockedUntil: ReadonlyMap<string, number>,
  now = Date.now()
): QueueTransition {
  if (items.length === 0) return { index: null, wrapped: false };

  const safeCurrentIndex = Math.min(Math.max(currentIndex, 0), items.length - 1);
  for (let offset = 1; offset <= items.length; offset += 1) {
    const candidateIndex = (safeCurrentIndex + offset) % items.length;
    if (!isItemTemporarilyBlocked(items[candidateIndex], blockedUntil, now)) {
      return {
        index: candidateIndex,
        wrapped: safeCurrentIndex + offset >= items.length,
      };
    }
  }

  return { index: null, wrapped: false };
}

/**
 * Ao entrar uma fila nova, continua depois do item atual quando ele ainda
 * existe. Caso contrário, começa no primeiro item elegível da nova decisão.
 */
export function pendingQueueStartIndex<T extends ContinuityQueueItem>(
  nextItems: readonly T[],
  currentItem: T | undefined,
  blockedUntil: ReadonlyMap<string, number>,
  now = Date.now()
): number | null {
  if (nextItems.length === 0) return null;
  const currentItemIndex = currentItem
    ? nextItems.findIndex((item) => item.id === currentItem.id)
    : -1;
  const anchor = currentItemIndex >= 0 ? currentItemIndex : nextItems.length - 1;
  return nextPlayableIndex(nextItems, anchor, blockedUntil, now).index;
}
