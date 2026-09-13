import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { eligibleOnlineSeconds } from '../src/lib/mpm/player-heartbeat.ts';

const at = (seconds: number) => new Date(Date.UTC(2026, 8, 13, 12, 0, seconds));
const interval = (overrides: Partial<Parameters<typeof eligibleOnlineSeconds>[0]> = {}) => ({
  previousAt: at(0),
  currentAt: at(30),
  previousSessionId: 'session-a',
  currentSessionId: 'session-a',
  previousInsideSchedule: true,
  currentInsideSchedule: true,
  previousHeartbeatId: 'heartbeat-1',
  currentHeartbeatId: 'heartbeat-2',
  ...overrides,
});

const root = process.cwd();
const player = fs.readFileSync(path.join(root, 'src/app/player/page.tsx'), 'utf8');
const action = fs.readFileSync(path.join(root, 'src/app/actions/pairing.ts'), 'utf8');
const identity = fs.readFileSync(path.join(root, 'src/lib/mpm/player-heartbeat.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260913000393_player_heartbeat_identity_and_continuity.sql'), 'utf8');

test('heartbeat normal t0, t0+30 e t0+60 acumula somente os dois intervalos observados', () => {
  const first = eligibleOnlineSeconds(interval({ previousAt: null }));
  const second = eligibleOnlineSeconds(interval());
  const third = eligibleOnlineSeconds(interval({ previousAt: at(30), currentAt: at(60), previousHeartbeatId: 'heartbeat-2', currentHeartbeatId: 'heartbeat-3' }));
  assert.deepEqual([first, second, third], [0, 30, 30]);
});

test('pequena variação dentro da tolerância contabiliza o intervalo real', () => {
  assert.equal(eligibleOnlineSeconds(interval({ currentAt: at(37) })), 37);
});

test('perda longa de cinco minutos não contabiliza 90 segundos artificiais', () => {
  assert.equal(eligibleOnlineSeconds(interval({ currentAt: at(300) })), 0);
  assert.doesNotMatch(migration, /least\(90/);
});

test('reconnect reinicia continuidade e só o heartbeat seguinte volta a contar', () => {
  const reconnect = eligibleOnlineSeconds(interval({ currentAt: at(300) }));
  const next = eligibleOnlineSeconds(interval({ previousAt: at(300), currentAt: at(330), previousHeartbeatId: 'heartbeat-2', currentHeartbeatId: 'heartbeat-3' }));
  assert.deepEqual([reconnect, next], [0, 30]);
});

test('heartbeat fora da agenda não produz segundos elegíveis nem cria ponte na entrada', () => {
  assert.equal(eligibleOnlineSeconds(interval({ currentInsideSchedule: false })), 0);
  assert.equal(eligibleOnlineSeconds(interval({ previousInsideSchedule: false })), 0);
});

test('fechamento e reabertura com nova sessão não herdam intervalo anterior', () => {
  assert.equal(eligibleOnlineSeconds(interval({ currentSessionId: 'session-b' })), 0);
  assert.match(migration, /p_player_session_id IS NOT DISTINCT FROM daily\.last_heartbeat_session_id/);
});

test('heartbeat repetido é idempotente', () => {
  assert.equal(eligibleOnlineSeconds(interval({ currentHeartbeatId: 'heartbeat-1' })), 0);
  assert.match(migration, /p_heartbeat_id=daily\.last_heartbeat_id/);
});

test('identidade de versão, build, commit, plataforma e runtime nasce no cliente', () => {
  for (const field of ['player_version', 'player_build', 'player_commit', 'platform', 'runtime_version']) {
    assert.match(identity, new RegExp(field));
  }
  assert.match(player, /createClientHeartbeatMetadata\(sessionIdRef\.current, heartbeatId\)/);
  assert.doesNotMatch(action, /PLAYER_BUILD_VERSION/);
  assert.doesNotMatch(action, /buildVersion:/);
});

test('heartbeat legado sem metadata continua compatível', () => {
  assert.match(action, /clientMetadata\?: PlayerHeartbeatMetadata/);
  assert.match(action, /legacyHeartbeatError/);
  assert.match(migration, /record_screen_capacity_heartbeat\(p_screen_id UUID\)/);
});
