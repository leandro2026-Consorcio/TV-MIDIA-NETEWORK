import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

const playlistPlayer = fs.readFileSync(path.join(root, 'src/app/actions/playlist-player.ts'), 'utf8');

test('Player usa timezone civil canônico da empresa para campanhas e conteúdo', () => {
  assert.match(playlistPlayer, /companies\(city, state, timezone\)/);
  assert.match(playlistPlayer, /campaign\.companies\?\.timezone/);
  assert.match(playlistPlayer, /currentBusinessDate\(campaignTimezone\)/);
  assert.match(playlistPlayer, /currentBusinessDate\(\(screen\.companies as any\)\?\.timezone/);
});
import {
  nextPlayableIndex,
  pendingQueueStartIndex,
  playableQueueItems,
  playbackAssetKey,
  recoveryStepForAttempt,
} from '../src/lib/mpm/player-continuity.ts';

const player = fs.readFileSync(path.join(root, 'src/app/player/page.tsx'), 'utf8');
const heartbeat = fs.readFileSync(path.join(root, 'src/app/actions/pairing.ts'), 'utf8');
const queue = (...ids: string[]) => ids.map((id) => ({ id, media_id: id, content_id: null }));
const noBlocks = new Map<string, number>();

test('1 item faz A -> A com wrap-around', () => {
  assert.deepEqual(nextPlayableIndex(queue('A'), 0, noBlocks, 1), { index: 0, wrapped: true });
});

test('2 itens fazem A -> B -> A', () => {
  const items = queue('A', 'B');
  assert.deepEqual(nextPlayableIndex(items, 0, noBlocks, 1), { index: 1, wrapped: false });
  assert.deepEqual(nextPlayableIndex(items, 1, noBlocks, 1), { index: 0, wrapped: true });
});

test('3 itens fazem A -> B -> C -> A', () => {
  const items = queue('A', 'B', 'C');
  assert.equal(nextPlayableIndex(items, 0, noBlocks, 1).index, 1);
  assert.equal(nextPlayableIndex(items, 1, noBlocks, 1).index, 2);
  assert.equal(nextPlayableIndex(items, 2, noBlocks, 1).index, 0);
});

test('RSS permanece na fila ao repetir um único vídeo', () => {
  const items = [
    { id: 'video:A', media_id: 'A', content_id: null },
    { id: 'rss:1', media_id: null, content_id: 'rss-1' },
  ];
  assert.equal(nextPlayableIndex(items, 0, noBlocks, 1).index, 1);
  assert.equal(nextPlayableIndex(items, 1, noBlocks, 1).index, 0);
});

test('RSS permanece ativo durante wrap de vários vídeos', () => {
  const items = [
    ...queue('A', 'B', 'C'),
    { id: 'rss:1', media_id: null, content_id: 'rss-1' },
  ];
  assert.equal(nextPlayableIndex(items, 2, noBlocks, 1).index, 3);
  assert.equal(nextPlayableIndex(items, 3, noBlocks, 1).index, 0);
});

test('asset com erro entra em cooldown e o próximo conteúdo/fallback é escolhido', () => {
  const items = queue('A', 'B');
  const blocks = new Map([[playbackAssetKey(items[0]), 10_000]]);
  assert.equal(nextPlayableIndex(items, 0, blocks, 1).index, 1);
  assert.deepEqual(playableQueueItems(items, blocks, 1).map((item) => item.id), ['B']);
});

test('novo conteúdo substitui a fila na próxima transição natural', () => {
  const current = queue('A');
  const updated = queue('A', 'B');
  assert.equal(pendingQueueStartIndex(updated, current[0], noBlocks, 1), 1);
});

test('ausência temporária de mídia retorna estado recuperável, sem índice inválido', () => {
  const items = queue('A');
  const blocks = new Map([['A', 10_000]]);
  assert.equal(nextPlayableIndex(items, 0, blocks, 1).index, null);
  assert.equal(playableQueueItems(items, blocks, 1).length, 0);
});

test('reconnect volta a tornar o asset elegível depois do cooldown', () => {
  const items = queue('A');
  const blocks = new Map([['A', 10_000]]);
  assert.equal(playableQueueItems(items, blocks, 1).length, 0);
  assert.equal(playableQueueItems(items, blocks, 10_001).length, 1);
});

test('recuperação é limitada a play, reload da mídia e skip', () => {
  assert.equal(recoveryStepForAttempt(1), 'play');
  assert.equal(recoveryStepForAttempt(2), 'reload');
  assert.equal(recoveryStepForAttempt(3), 'skip');
  assert.equal(recoveryStepForAttempt(99), 'skip');
});

test('player usa play explícito, watchdog e não recarrega a página', () => {
  assert.match(player, /PLAYER_WATCHDOG_INTERVAL_MS/);
  assert.match(player, /video\.play\(\)/);
  assert.match(player, /finishCurrentSlideAndLog\('failed'/);
  assert.doesNotMatch(player, /window\.location\.reload/);
});

test('heartbeat permanece independente e não reinicia mídia saudável', () => {
  assert.match(heartbeat, /record_screen_capacity_heartbeat/);
  assert.doesNotMatch(heartbeat, /video|playbackCycle|currentIndex/);
});
