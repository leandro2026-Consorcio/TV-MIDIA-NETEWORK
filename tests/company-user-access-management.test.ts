import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260916000398_company_user_access_management.sql'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'supabase/migrations/20260804000036_phase6c_public_onboarding.sql'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'src/app/actions/company-users.ts'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/(dashboard)/layout.tsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(root, 'src/components/sidebar.tsx'), 'utf8');
const externalDoc = fs.readFileSync(path.join(root, 'docs/PROGRAMACAO_TV_CONTEUDO_EXTERNO.md'), 'utf8');

test('criador da empresa vira ADMIN na mesma transação do onboarding', () => {
  assert.match(onboarding, /INSERT INTO public\.companies[\s\S]*INSERT INTO public\.company_users[\s\S]*'admin', TRUE/);
  assert.match(onboarding, /complete_public_company_onboarding/);
});

test('convite é restrito a ADMIN ou MASTER, expira, é de uso único e fixa empresa e role no banco', () => {
  assert.match(migration, /is_company_admin\(p_company_id, auth\.uid\(\)\)/);
  assert.match(migration, /NOW\(\) \+ INTERVAL '7 days'/);
  assert.match(migration, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(migration, /provisioned_user_id UUID/);
  assert.match(migration, /p_role NOT IN \('admin', 'marketing'\)/);
  assert.match(migration, /v_invite\.company_id[\s\S]*v_invite\.role/);
  assert.doesNotMatch(actions, /default_password|senha padrão/i);
});

test('MARKETING não administra usuários nem eleva a própria role', () => {
  assert.match(migration, /Apenas ADMIN da empresa ou MASTER pode convidar usuários/);
  assert.match(migration, /Apenas ADMIN da empresa ou MASTER pode alterar perfis/);
  assert.match(layout, /activeRole !== 'marketing'/);
  assert.match(sidebar, /companyRole === 'marketing' \? marketingGroups/);
});

test('último ADMIN não pode ser removido ou rebaixado', () => {
  assert.match(migration, /protect_last_company_admin/);
  assert.match(migration, /A empresa precisa manter pelo menos um ADMIN ativo/);
  assert.match(migration, /BEFORE UPDATE OF role, is_active OR DELETE/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

test('isolamento usa company_id, RLS e RPC server-side; Master permanece global', () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /public\.is_master_admin\(\)/);
  assert.match(migration, /WHERE cu\.company_id = p_company_id/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
});

test('troca de empresa deriva role do vínculo ativo e não oferece menu administrativo a marketing', () => {
  assert.match(layout, /select\('company_id, role'\)/);
  assert.match(layout, /setCompanyRoles/);
  assert.match(sidebar, /Usuários e Acessos/);
  assert.match(sidebar, /companyRole === 'admin'/);
});

test('YouTube e programação externa estão somente documentados', () => {
  assert.match(externalDoc, /Não implementado nesta fase/);
  assert.match(externalDoc, /EXCLUSIVO/);
  assert.match(externalDoc, /COM INTERVALOS MPM/);
  assert.match(externalDoc, /não cria Crédito MPM/);
  assert.match(externalDoc, /nunca deve pedir, receber ou armazenar senha Google/);
});
