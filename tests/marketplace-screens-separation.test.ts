import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migration = readFileSync(join(root, 'supabase/migrations/20260912000387_marketplace_screen_projection.sql'), 'utf8');
const companyActiveMigration = readFileSync(join(root, 'supabase/migrations/20260912000388_company_active_marketplace_guard.sql'), 'utf8');
const marketplaceAction = readFileSync(join(root, 'src/app/actions/marketplace-omnichannel.ts'), 'utf8');
const privateAction = readFileSync(join(root, 'src/app/actions/screens.ts'), 'utf8');
const page = readFileSync(join(root, 'src/app/(dashboard)/marketplace/page.tsx'), 'utf8');
const mapPage = readFileSync(join(root, 'src/app/onde-anunciar/page.tsx'), 'utf8');
const distributionAction = readFileSync(join(root, 'src/app/actions/marketplace.ts'), 'utf8');

test('Minhas TVs continua usando consulta privada limitada ao company_id', () => {
  assert.match(privateAction, /getMyCompanyScreensAction/);
  assert.match(privateAction, /\.eq\('company_id', companyId\)/);
  assert.match(privateAction, /Empresa não autorizada para este usuário/);
  assert.doesNotMatch(privateAction, /get_marketplace_screens/);
});

test('Marketplace usa projeção dedicada e não reutiliza a consulta de Minhas TVs', () => {
  assert.match(marketplaceAction, /rpc as any\)\('get_marketplace_screens'/);
  assert.doesNotMatch(marketplaceAction, /from\('screens'\)/);
  assert.doesNotMatch(marketplaceAction, /getMyCompanyScreensAction/);
});

test('projeção inclui A1 e B1 públicas, excluindo C1 privada e P1 residencial', () => {
  assert.match(migration, /s\.is_public_screen = TRUE/);
  assert.match(migration, /s\.venue_type <> 'residential'/);
  assert.match(migration, /s\.status = 'online'/);
  assert.match(migration, /c\.is_active = TRUE/);
  assert.match(migration, /c\.show_in_marketplace = TRUE/);
  assert.match(migration, /COALESCE\(np\.accepts_network_ads, TRUE\) = TRUE/);
  assert.doesNotMatch(migration, /s\.company_id = p_viewer_company_id/);
});

test('empresa proprietária possui estado ativo incremental usado pela projeção', () => {
  assert.match(companyActiveMigration, /ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(companyActiveMigration, /idx_companies_marketplace_active/);
  assert.match(migration, /c\.is_active = TRUE/);
});

test('projeção expõe somente campos comerciais e mascara localização', () => {
  assert.match(migration, /public_address_masked/);
  assert.match(migration, /show_location_publicly/);
  assert.doesNotMatch(migration, /device_token_hash/);
  assert.doesNotMatch(migration, /\bcnpj\b/);
  assert.doesNotMatch(migration, /\baddress\b/);
});

test('Cidade, ramo e busca são combinados no servidor e opções vêm do inventário elegível', () => {
  assert.match(migration, /p_city/);
  assert.match(migration, /p_venue_category/);
  assert.match(migration, /p_search/);
  assert.match(migration, /SELECT DISTINCT city FROM eligible/);
  assert.match(migration, /SELECT DISTINCT venue_category FROM eligible/);
  assert.match(page, /Todas as cidades/);
  assert.match(page, /Todos os ramos de atividade/);
  assert.match(page, /TVs disponíveis/);
});

test('inventário diferencia indisponibilidade temporária sem prometer capacidade inexistente', () => {
  assert.match(migration, /inventory_capacity_periods/);
  assert.match(migration, /available_capacity <= 0/);
  assert.match(migration, /temporarily_unavailable/);
  assert.match(page, /Indisponível temporariamente/);
});

test('TV própria é marcada e fluxo canônico bloqueia auto-remuneração', () => {
  assert.match(migration, /AS is_own/);
  assert.match(page, /Sua TV/);
  assert.match(page, /USAR NA MINHA CAMPANHA/);
  assert.match(distributionAction, /screen\.company_id === campaign\.company_id/);
  assert.match(distributionAction, /mode: 'internal'/);
});

test('mapa recebe os mesmos filtros e usa a mesma projeção elegível', () => {
  assert.match(page, /onde-anunciar\?city=/);
  assert.match(page, /category=/);
  assert.match(mapPage, /getMarketplaceScreensAction/);
  assert.match(mapPage, /venueCategory: searchParams\?\.category/);
});

test('filtros mobile usam grid de uma coluna sem largura fixa', () => {
  assert.match(page, /grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2/);
  assert.match(page, /min-w-0 w-full/);
  assert.doesNotMatch(page, /overflow-x-hidden/);
});
