import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const page = readFileSync(join(root, 'src/app/(dashboard)/marketplace/page.tsx'), 'utf8');
const action = readFileSync(join(root, 'src/app/actions/marketplace.ts'), 'utf8');
const migration = readFileSync(join(root, 'supabase/migrations/20260913000394_campaign_screen_marketplace_request.sql'), 'utf8');

test('troca de campanha limpa contexto e ignora respostas assíncronas antigas', () => {
  assert.match(page, /setSelectedCampaign\(null\)/);
  assert.match(page, /let cancelled = false/);
  assert.match(page, /if \(cancelled\) return/);
  assert.match(page, /return \(\) => \{ cancelled = true; \}/);
});

test('solicitação campanha-TV usa RPC canônica e não faz vínculo posterior no cliente', () => {
  assert.match(action, /create_campaign_screen_marketplace_request/);
  assert.doesNotMatch(action, /update\(\{ campaign_id: campaign\.id \}\)/);
});

test('solicitação campanha-TV é validada, idempotente e preserva o alvo', () => {
  assert.match(migration, /target_screen_id UUID/);
  assert.match(migration, /uq_active_campaign_screen_request/);
  assert.match(migration, /Campanha não encontrada/);
  assert.match(migration, /campaign_id = p_campaign_id AND target_screen_id = p_screen_id/);
  assert.match(migration, /company_users/);
  assert.match(migration, /approval_status.*pending_approval/);
});

