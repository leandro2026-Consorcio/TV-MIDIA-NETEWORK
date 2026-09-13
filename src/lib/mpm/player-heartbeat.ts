export const MAX_CONTINUOUS_HEARTBEAT_GAP_SECONDS = 75;

export interface PlayerHeartbeatMetadata {
  heartbeat_id?: string | null;
  player_session_id?: string | null;
  player_version?: string | null;
  player_build?: string | null;
  player_commit?: string | null;
  platform?: string | null;
  runtime_version?: string | null;
}

export interface HeartbeatContinuityInput {
  previousAt: Date | null;
  currentAt: Date;
  previousSessionId: string | null;
  currentSessionId: string | null;
  previousInsideSchedule: boolean;
  currentInsideSchedule: boolean;
  previousHeartbeatId?: string | null;
  currentHeartbeatId?: string | null;
}

/**
 * Conta somente um intervalo curto, observado na mesma sessão e com os dois
 * heartbeats dentro da agenda. Ausência longa e troca de sessão reiniciam a
 * continuidade sem transformar tempo offline em tempo online.
 */
export function eligibleOnlineSeconds(input: HeartbeatContinuityInput): number {
  if (input.currentHeartbeatId && input.currentHeartbeatId === input.previousHeartbeatId) return 0;
  if (!input.previousAt || !input.previousInsideSchedule || !input.currentInsideSchedule) return 0;
  if (input.previousSessionId !== input.currentSessionId) return 0;

  const elapsed = Math.floor((input.currentAt.getTime() - input.previousAt.getTime()) / 1000);
  if (elapsed <= 0 || elapsed > MAX_CONTINUOUS_HEARTBEAT_GAP_SECONDS) return 0;
  return elapsed;
}

function clientPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || nav.platform || 'web';
}

/** Metadados compilados no próprio bundle do Player e enviados pelo cliente. */
export function createClientHeartbeatMetadata(sessionId: string, heartbeatId: string): PlayerHeartbeatMetadata {
  return {
    heartbeat_id: heartbeatId,
    player_session_id: sessionId,
    player_version: process.env.NEXT_PUBLIC_MPM_PLAYER_VERSION || 'development',
    player_build: process.env.NEXT_PUBLIC_MPM_PLAYER_BUILD || 'development',
    player_commit: process.env.NEXT_PUBLIC_MPM_PLAYER_COMMIT || 'development',
    platform: clientPlatform(),
    runtime_version: process.env.NEXT_PUBLIC_MPM_PLAYER_RUNTIME || 'web',
  };
}
