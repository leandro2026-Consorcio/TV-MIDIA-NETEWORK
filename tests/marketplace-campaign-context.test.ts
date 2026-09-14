import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const page = readFileSync(join(root, 'src/app/(dashboard)/marketplace/page.tsx'), 'utf8');
const action = readFileSync(join(root, 'src/app/actions/marketplace.ts'), 'utf8');
const migration = readFileSync(join(root, 'supabase/migrations/20260913000394_campaign_screen_marketplace_request.sql'), 'utf8');
const offerResolution = readFileSync(join(root, 'supabase/migrations/20260913000395_marketplace_request_offer_resolution.sql'), 'utf8');
const civilDateFix = readFileSync(join(root, 'supabase/migrations/20260913000396_marketplace_request_civil_date.sql'), 'utf8');

test('troca de campanha limpa contexto e ignora respostas assíncronas antigas', () => {
  assert.match(page, /setSelectedCampaign\(null\)/);
  assert.match(page, /let cancelled = false/);
  assert.match(page, /if \(cancelled\) return/);
  assert.match(page, /return \(\) => \{ cancelled = true; \}/);
});

test('solicitação campanha-TV usa RPC canônica e não faz vínculo posterior no cliente', () => {
  assert.match(action, /create_campaign_screen_marketplace_request/);
  assert.match(page, /create_campaign_screen_marketplace_request/);
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

test('oferta operacional é reutilizada ou criada atomicamente sem duplicidade concorrente', () => {
  assert.match(offerResolution, /pg_advisory_xact_lock/);
  assert.match(offerResolution, /v_created_offer\s+BOOLEAN\s*:=\s*false/i);
  assert.match(offerResolution, /IF\s+v_created_offer\s+THEN\s+DELETE\s+FROM\s+public\.company_ad_offers/i);
  assert.match(offerResolution, /SELECT o\.\* INTO v_offer[\s\S]*o\.company_id=v_screen\.company_id/);
  assert.match(offerResolution, /INSERT INTO public\.company_ad_offers/);
  assert.match(offerResolution, /v_result:=public\.create_marketplace_media_request\(v_offer\.id/);
  assert.match(offerResolution, /campaign_id=p_campaign_id AND target_screen_id=p_screen_id/);
});

test('TV própria preserva vínculo interno e não cria solicitação de Marketplace', () => {
  assert.match(page, /hiringScreen\.companyId === selectedCampaign\.company_id/);
  assert.match(page, /from\('campaign_screens'\)/);
});

test('fim da campanha respeita a data civil de Cuiabá em vez da data UTC do banco', () => {
  assert.match(civilDateFix, /now\(\) AT TIME ZONE 'America\/Cuiaba'/);
  assert.doesNotMatch(civilDateFix, /end_date\s*<\s*CURRENT_DATE/i);
});
