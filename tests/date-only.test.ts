import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateOnlyPtBr } from '../src/lib/date-only.ts';

for (const [input, expected] of [
  ['2026-09-08', '08/09/2026'],
  ['2026-09-13', '13/09/2026'],
  ['2026-01-01', '01/01/2026'],
  ['2026-12-31', '31/12/2026'],
] as const) {
  test(`DATE-only ${input} is civil in every timezone`, () => {
    assert.equal(formatDateOnlyPtBr(input), expected);
  });
}
