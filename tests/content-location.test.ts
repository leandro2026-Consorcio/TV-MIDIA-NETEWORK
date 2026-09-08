import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contentCityMatches,
  contentRegionMatchesState,
  normalizeContentLocation,
} from '../src/lib/content-location.ts';

test('normaliza acentos e caixa para filtros de conteúdo', () => {
  assert.equal(normalizeContentLocation(' SÃO PAULO '), 'sao paulo');
});

test('conteúdo nacional e cidade Todas são válidos para qualquer tela', () => {
  assert.equal(contentCityMatches('Todas', 'SINOP'), true);
  assert.equal(contentRegionMatchesState('Brasil', 'MT'), true);
  assert.equal(contentRegionMatchesState('Nacional', 'SP'), true);
});

test('conteúdo local continua limitado à cidade e ao estado corretos', () => {
  assert.equal(contentCityMatches('Sinop', 'SINOP'), true);
  assert.equal(contentCityMatches('Cuiabá', 'SINOP'), false);
  assert.equal(contentRegionMatchesState('MT', 'MT'), true);
  assert.equal(contentRegionMatchesState('SP', 'MT'), false);
});

test('macrorregião continua abrangendo seus estados', () => {
  assert.equal(contentRegionMatchesState('Centro-Oeste', 'MT'), true);
  assert.equal(contentRegionMatchesState('Sul', 'MT'), false);
});
