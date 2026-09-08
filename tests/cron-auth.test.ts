import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hasValidCronAuthorization } from '../src/lib/cron-auth.ts';

const route = readFileSync(new URL('../src/app/api/cron/mpm-maintenance/route.ts', import.meta.url), 'utf8');

test('cron MPM nega secret ausente e Authorization ausente ou inválida', () => {
  assert.equal(hasValidCronAuthorization(null, undefined), false);
  assert.equal(hasValidCronAuthorization(null, 'cron-secret'), false);
  assert.equal(hasValidCronAuthorization('Bearer incorreto', 'cron-secret'), false);
});

test('User-Agent falsificado não participa da autorização do cron MPM', () => {
  assert.doesNotMatch(route, /user-agent|vercel-cron/i);
  assert.equal(hasValidCronAuthorization(null, 'cron-secret'), false);
});

test('cron MPM permite Bearer correto e só cria admin client depois da autenticação', () => {
  assert.equal(hasValidCronAuthorization('Bearer cron-secret', 'cron-secret'), true);
  assert.ok(route.indexOf('hasValidCronAuthorization') < route.indexOf('createAdminClient()'));
});
