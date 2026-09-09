import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migrationContent = readFileSync(
  join(root, 'supabase/migrations/20260909000320_fix_content_settings_and_network_prefs.sql'),
  'utf8'
);
const networkAction = readFileSync(join(root, 'src/app/actions/network.ts'), 'utf8');
const networkSettingsPage = readFileSync(join(root, 'src/app/(dashboard)/network-settings/page.tsx'), 'utf8');
const companySourcesAction = readFileSync(join(root, 'src/app/actions/company-content-sources.ts'), 'utf8');
const onboardingAction = readFileSync(join(root, 'src/app/actions/onboarding.ts'), 'utf8');
const checklistComponent = readFileSync(join(root, 'src/components/getting-started-checklist.tsx'), 'utf8');
const inventoryPage = readFileSync(join(root, 'src/app/(dashboard)/screens/[id]/inventory/page.tsx'), 'utf8');
const contentSettingsPage = readFileSync(join(root, 'src/app/(dashboard)/screens/[id]/content-settings/page.tsx'), 'utf8');
const campaignsPage = readFileSync(join(root, 'src/app/(dashboard)/campaigns/page.tsx'), 'utf8');
const campaignEditor = readFileSync(join(root, 'src/components/internal-campaign-editor.tsx'), 'utf8');
const invitesPage = readFileSync(join(root, 'src/app/(dashboard)/company/invites/page.tsx'), 'utf8');
const layoutPage = readFileSync(join(root, 'src/app/(dashboard)/layout.tsx'), 'utf8');

test('migration: constraint screen_content_settings_ads_between_content_check aceita valores de 1 a 5', () => {
  assert.match(migrationContent, /DROP CONSTRAINT IF EXISTS screen_content_settings_ads_between_content_check/);
  assert.match(migrationContent, /CHECK \(ads_between_content BETWEEN 1 AND 5\)/);
});

test('migration: adiciona allowed_source_ids e colunas de empresa a content_sources', () => {
  assert.match(migrationContent, /ADD COLUMN IF NOT EXISTS allowed_source_ids UUID\[\]/);
  assert.match(migrationContent, /ADD COLUMN IF NOT EXISTS company_id UUID/);
  assert.match(migrationContent, /ADD COLUMN IF NOT EXISTS is_private BOOLEAN/);
  assert.match(migrationContent, /ADD COLUMN IF NOT EXISTS suggested_for_catalog BOOLEAN/);
  assert.match(migrationContent, /ADD COLUMN IF NOT EXISTS approval_status TEXT/);
});

test('migration: configura chaves de convite VIP em platform_settings', () => {
  assert.match(migrationContent, /'minimum_vip_invites'/);
  assert.match(migrationContent, /'vip_invite_referrer_reward'/);
  assert.match(migrationContent, /'vip_invite_referred_benefit'/);
});

test('participação na rede: canonicaliza em accepts_network_ads e não usa participates_in_network', () => {
  // src/app/actions/network.ts deve consultar accepts_network_ads
  assert.match(networkAction, /eq\('accepts_network_ads', true\)/);
  assert.doesNotMatch(networkAction, /participates_in_network/);

  // network-settings page deve usar accepts_network_ads
  assert.match(networkSettingsPage, /accepts_network_ads/);
  assert.doesNotMatch(networkSettingsPage, /participates_in_network/);
});

test('segurança SSRF: company-content-sources bloqueia endereços privados e localhost', () => {
  assert.match(companySourcesAction, /isPrivateAddress/);
  assert.match(companySourcesAction, /assertSafeUrl/);
  assert.match(companySourcesAction, /localhost/);
  assert.match(companySourcesAction, /octets\[0\] === 169 && octets\[1\] === 254/);
  assert.match(companySourcesAction, /O endereço aponta para uma rede privada ou reservada/);
});

test('onboarding: assegura no mínimo 3 convites VIP com recompensa de mensalidade', () => {
  assert.match(onboardingAction, /ensureCompanyVipInvites/);
  assert.match(onboardingAction, /Math\.max\(0, 3 - activeCount\)/);
  assert.match(onboardingAction, /vip_invite_referrer_reward/);
});

test('checklist: atualiza link de conteúdo informativo para a empresa e não fixa 60 dias em convites', () => {
  assert.match(checklistComponent, /href="\/company\/content-sources"/);
  assert.doesNotMatch(checklistComponent, /href="\/admin\/content-sources"/);
  assert.match(checklistComponent, /title="Conteúdo Informativo"/);
  assert.doesNotMatch(checklistComponent, /liberar 60 dias de trial/);
});

test('telas: inventário e conteúdo de respiro com linguagem clara e navegação fluida', () => {
  assert.match(inventoryPage, /Como esta TV participa da Rede MPM/);
  assert.match(inventoryPage, /Capacidade ainda não calculada/);
  assert.match(inventoryPage, /Compartilhar espaço não utilizado/);
  assert.match(inventoryPage, /CONTINUAR PARA CONTEÚDO ENTRE PROPAGANDAS/);

  assert.match(contentSettingsPage, /Conteúdo entre propagandas/);
  assert.match(contentSettingsPage, /Foco em publicidade/);
  assert.match(contentSettingsPage, /Foco em informação/);
  assert.match(contentSettingsPage, /CONTINUAR CONFIGURAÇÃO \(CONVITES VIP\)/);
});

test('campanhas: identificação como Minhas Campanhas e CTA para Marketplace', () => {
  assert.match(campaignsPage, /Minhas Campanhas/);
  assert.match(campaignsPage, /ENCONTRAR TVs NO MARKETPLACE/);
  assert.match(campaignsPage, /href="\/marketplace"/);

  assert.match(campaignEditor, /Minhas TVs participantes/);
  assert.match(campaignEditor, /Escolha em quais TVs da sua empresa esta campanha será exibida/);
  assert.match(campaignEditor, /ENCONTRAR TVs NO MARKETPLACE/);
});

test('convites VIP: não fixa 60 dias, tem WhatsApp e fluxo não bloqueante', () => {
  assert.doesNotMatch(invitesPage, /60 dias gratuitos/);
  assert.match(invitesPage, /api\.whatsapp\.com\/send/);
  assert.match(invitesPage, /Fazer depois/);
  assert.match(invitesPage, /Sua recompensa: Ganhe 1 mensalidade/);
  assert.match(invitesPage, /CONTINUAR CONFIGURAÇÃO/);
});

test('layout: permite rotas de empresa em trial e inclui OnboardingProgressBar', () => {
  assert.match(layoutPage, /'\/company\/content-sources'/);
  assert.match(layoutPage, /'\/network-settings'/);
  assert.match(layoutPage, /OnboardingProgressBar/);
});
