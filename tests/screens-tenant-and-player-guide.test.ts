import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const action = readFileSync(join(root, 'src/app/actions/screens.ts'), 'utf8');
const screensPage = readFileSync(join(root, 'src/app/(dashboard)/screens/page.tsx'), 'utf8');
const layout = readFileSync(join(root, 'src/app/(dashboard)/layout.tsx'), 'utf8');
const header = readFileSync(join(root, 'src/components/header.tsx'), 'utf8');
const switcher = readFileSync(join(root, 'src/components/company-switcher.tsx'), 'utf8');
const help = readFileSync(join(root, 'src/app/(dashboard)/help/getting-started/page.tsx'), 'utf8');
const organicAction = readFileSync(join(root, 'src/app/actions/organic-network.ts'), 'utf8');
const sidebar = readFileSync(join(root, 'src/components/sidebar.tsx'), 'utf8');

test('Minhas TVs: chamada server-side exige autenticação, vínculo ativo e company_id explícito', () => {
  assert.match(action, /supabase\.auth\.getUser\(\)/);
  assert.match(action, /\.eq\('user_id', user\.id\)/);
  assert.match(action, /\.eq\('company_id', companyId\)/);
  assert.match(action, /\.eq\('is_active', true\)/);
  assert.match(action, /if \(!profile\?\.is_master_admin && !membership\)/);
  assert.match(action, /Empresa não autorizada para este usuário/);
});

test('isolamento A/B: consulta retorna somente screens do tenant autorizado selecionado', () => {
  const explicitCompanyFilters = action.match(/\.eq\('company_id', companyId\)/g) || [];
  assert.ok(explicitCompanyFilters.length >= 2, 'vínculo e screens devem usar o mesmo company_id');
  assert.doesNotMatch(screensPage, /from\('screens'\)/);
  assert.match(screensPage, /getMyCompanyScreensAction\(activeCompany\.id\)/);
});

test('PF e Creator: TVs residenciais ficam no ownership orgânico e não entram em Minhas TVs empresarial', () => {
  assert.match(organicAction, /from\('organic_screens'\)/);
  assert.match(organicAction, /participant_id/);
  assert.match(sidebar, /href: '\/organic'/);
  assert.doesNotMatch(action, /organic_screens/);
});

test('Master: contexto empresarial selecionado é preservado sem consulta global na página comum', () => {
  assert.match(action, /profile\?\.is_master_admin/);
  assert.match(layout, /DashboardCompanyProvider activeCompany=\{activeCompany\}/);
  assert.match(screensPage, /TVs vinculadas a \$\{activeCompany\.trade_name\}/);
});

test('guia separa Smart TV sem EXE de Windows com instalador existente', () => {
  assert.match(help, /Como você vai usar sua tela/);
  assert.match(help, /SMART TV/);
  assert.match(help, /Não precisa baixar nenhum programa/);
  assert.match(help, /midiapormidia\.com\.br\/tv/);
  assert.match(help, /WINDOWS \/ MONITOR PROFISSIONAL/);
  assert.match(help, /MPM-Player-Setup\.exe/);
  assert.match(help, /\/downloads\/mpm-player\/windows/);
  assert.match(help, /ConditionalPwaInstall/);
});

test('CTA Adicionar TV pergunta o tipo e encaminha aos dois fluxos', () => {
  assert.match(screensPage, /Como você deseja conectar/);
  assert.match(screensPage, /\/screens\/new\?device=tv/);
  assert.match(screensPage, /\/screens\/new\?device=windows_monitor/);
  assert.match(screensPage, /screen\.device_type === 'windows_monitor'/);
  assert.match(screensPage, /venue_type === 'residential'/);
});

for (const width of [375, 390, 430]) {
  test(`mobile ${width}px: estruturas críticas encolhem sem esconder overflow`, () => {
    assert.match(layout, /min-w-0/);
    assert.match(header, /min-w-0 max-w-full/);
    assert.match(switcher, /w-full min-w-0 max-w-\[210px\]/);
    assert.match(screensPage, /min-w-0 w-full/);
    assert.doesNotMatch([layout, header, switcher, screensPage].join('\n'), /overflow-x-hidden/);
  });
}

test('desktop: grid responsivo e seletor mantêm dimensões próprias em sm/md/lg', () => {
  assert.match(screensPage, /md:grid-cols-2 lg:grid-cols-3/);
  assert.match(switcher, /sm:min-w-\[200px\]/);
});
