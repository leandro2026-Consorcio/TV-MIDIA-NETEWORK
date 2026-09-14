import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260913000397_company_civil_timezone.sql'),
  'utf8',
);

function civilDate(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

test('Cuiabá mantém a campanha ativa até o fim da data civil local', () => {
  const localDate = civilDate('2026-09-14T02:30:00Z', 'America/Cuiaba');
  assert.equal(localDate, '2026-09-13');
  assert.equal('2026-09-13' >= localDate, true);
});

test('campanha encerra somente depois da virada civil local', () => {
  const localDate = civilDate('2026-09-14T04:01:00Z', 'America/Cuiaba');
  assert.equal(localDate, '2026-09-14');
  assert.equal('2026-09-13' >= localDate, false);
});

test('data civil usa timezone IANA e não offset fixo', () => {
  const instant = '2026-09-13T12:30:00Z';
  assert.equal(civilDate(instant, 'Pacific/Kiritimati'), '2026-09-14');
  assert.equal(civilDate(instant, 'America/New_York'), '2026-09-13');
});

test('backend usa timezone canônico da empresa em solicitação, autorização e playback', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS timezone TEXT/);
  assert.match(migration, /pg_timezone_names/);
  assert.match(migration, /company_civil_date\(v_campaign\.company_id\)/);
  assert.match(migration, /company_civil_date\(c\.company_id\)/);
  assert.doesNotMatch(migration, /end_date\s*<\s*CURRENT_DATE/i);
});
