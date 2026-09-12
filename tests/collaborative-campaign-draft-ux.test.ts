import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const client = fs.readFileSync(path.join(root, 'src/app/(dashboard)/collaborative-network/collaborative-network-client.tsx'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'src/app/actions/collaborative-network.ts'), 'utf8');
const marketplace = fs.readFileSync(path.join(root, 'src/app/(dashboard)/marketplace/page.tsx'), 'utf8');

test('página carregada não cria rascunho sem intenção', () => {
  const hydrationEffect = client.split('\n').find((line) => line.includes("params.get('draft')")) || '';
  assert.ok(hydrationEffect);
  assert.doesNotMatch(hydrationEffect, /saveDraft\(/);
});

test('campos possuem labels, ajuda e unidade econômica reais', () => {
  for (const label of ['Data de início', 'Data de término', 'Orçamento total da campanha', 'Unidade do orçamento']) assert.match(client, new RegExp(label));
  assert.match(client, /budgetTotal/);
  assert.match(client, /Créditos MPM/);
  assert.match(client, /Direito de Mídia/);
});

test('data final anterior à inicial é validada no cliente e servidor', () => {
  assert.match(client, /endsOn<form\.startsOn/);
  assert.match(actions, /input\.endsOn < input\.startsOn/);
});

test('destinos dependentes acionam persistência e recebem campaign_id', () => {
  assert.match(client, /collaborativeTvs.*collaborativeBusinesses.*collaborativeCreators[^]*saveDraft\(next\)/);
  assert.match(client, /marketplace\?tab=tvs&campaign_id=\$\{campaignId\}/);
  assert.match(client, /marketplace\?tab=creators&campaign_id=\$\{campaignId\}/);
});

test('rascunho usa insert idempotente uma vez e update no mesmo campaign_id', () => {
  assert.match(actions, /if \(input\.campaignId\)/);
  assert.match(actions, /\.eq\('id', input\.campaignId\)/);
  assert.match(actions, /p_idempotency_key: input\.idempotencyKey/);
  assert.match(client, /setCampaignId\(r\.campaignId\)/);
});

test('rascunho pode ser reaberto e retornar do Marketplace sem perder contexto', () => {
  assert.match(client, /params\.get\('draft'\)/);
  assert.match(client, /CONTINUAR EDIÇÃO/);
  assert.match(marketplace, /collaborative-network\?draft=\$\{selectedCampaign\.id\}/);
});

test('rollout Master não bloqueia salvar rascunho e continua explícito', () => {
  assert.doesNotMatch(client, /disabled=\{pending\s*\|\|\s*!enabled\}/);
  assert.match(client, /Aguardando liberação do Master/);
  assert.match(client, /somente a ativação permanece bloqueada/);
});

test('layout empilha campos críticos no mobile', () => {
  assert.match(client, /grid gap-4 sm:grid-cols-2/);
  assert.match(client, /flex flex-col gap-3 sm:flex-row/);
});
