import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve('scripts/assert-not-production.mjs');
const productionRef = 'ubvtfhilsdqgqiwnfciw';
const homologationRef = 'abcdefghijklmnopqrst';

function run(extraEnv: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'mpm-guard-'));
  try {
    return spawnSync(process.execPath, [script], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        MPM_ENV: '',
        MPM_HOMOLOGATION_PROJECT_REF: '',
        SUPABASE_PROJECT_REF: '',
        SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_URL: '',
        ...extraEnv,
      },
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('guarda exige ambiente de homologação explícito', () => {
  const result = run({ SUPABASE_PROJECT_REF: homologationRef });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MPM_ENV/);
});

test('guarda bloqueia o project ref de produção', () => {
  const result = run({
    MPM_ENV: 'homologation',
    MPM_HOMOLOGATION_PROJECT_REF: productionRef,
    SUPABASE_PROJECT_REF: productionRef,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PRODUÇÃO/);
});

test('guarda bloqueia divergência entre ref esperado e URL', () => {
  const result = run({
    MPM_ENV: 'homologation',
    MPM_HOMOLOGATION_PROJECT_REF: homologationRef,
    SUPABASE_URL: `https://${productionRef}.supabase.co`,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PRODUÇÃO/);
});

test('guarda aprova somente ref isolado e consistente', () => {
  const result = run({
    MPM_ENV: 'homologation',
    MPM_HOMOLOGATION_PROJECT_REF: homologationRef,
    SUPABASE_PROJECT_REF: homologationRef,
    SUPABASE_URL: `https://${homologationRef}.supabase.co`,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS/);
  assert.doesNotMatch(result.stdout, new RegExp(homologationRef));
});
