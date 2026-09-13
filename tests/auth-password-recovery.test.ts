import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePassword, validateResetEmail } from '../src/lib/auth-constants.ts';

const rootDir = process.cwd();
const legacyUniversalPassword = ['midia', 'pormidia', '@123'].join('');
const read = (...parts: string[]) => readFileSync(join(rootDir, ...parts), 'utf8');

test('autenticação não exporta nem aplica senha inicial universal', () => {
  const constants = read('src', 'lib', 'auth-constants.ts');
  const onboarding = read('src', 'app', 'actions', 'onboarding.ts');
  assert.doesNotMatch(constants, /DEFAULT_INITIAL_PASSWORD/);
  assert.doesNotMatch(onboarding, /DEFAULT_INITIAL_PASSWORD/);
  assert.ok(onboarding.includes('validatePassword(payload.password)'));
  assert.equal(constants.includes(legacyUniversalPassword), false);
});

test('validação de e-mail de recuperação rejeita e-mail inválido', () => {
  assert.equal(validateResetEmail('').valid, false);
  assert.equal(validateResetEmail('email-sem-formato').valid, false);
  assert.equal(validateResetEmail('usuario@empresa.com.br').valid, true);
});

test('validação exige senha pessoal com no mínimo 6 caracteres', () => {
  assert.equal(validatePassword('123').valid, false);
  assert.equal(validatePassword('SenhaPessoal#2026').valid, true);
});

test('middleware mantém recuperação e redefinição públicas', () => {
  const content = read('src', 'lib', 'supabase', 'middleware.ts');
  for (const route of ['/forgot-password', '/recuperar-senha', '/reset-password', '/redefinir-senha', '/auth/']) {
    assert.ok(content.includes(`pathname.startsWith('${route}')`), `Falta ${route} no middleware`);
  }
});

test('cadastro da empresa exige senha pessoal sem default, placeholder ou mensagem universal', () => {
  const form = read('src', 'components', 'company-signup-form.tsx');
  const action = read('src', 'app', 'actions', 'onboarding.ts');
  assert.ok(form.includes('placeholder="Crie uma senha pessoal"'));
  assert.equal(form.includes(legacyUniversalPassword), false);
  assert.equal(action.includes(legacyUniversalPassword), false);
  assert.match(action, /initial_password: false/);
  assert.match(action, /must_change_password: false/);
});

test('cadastro orgânico começa sem senha e exige senha pessoal', () => {
  const content = read('src', 'app', 'organic', 'register', 'page.tsx');
  assert.match(content, /password: ''/);
  assert.match(content, /Crie uma senha pessoal e exclusiva/);
  assert.equal(content.includes(legacyUniversalPassword), false);
});

test('login e recuperação não divulgam senha universal', () => {
  const login = read('src', 'app', '(auth)', 'login', 'page.tsx');
  const reset = read('src', 'app', '(auth)', 'reset-password', 'page.tsx');
  assert.match(login, /Esqueci minha senha/);
  assert.match(login, /Recuperar Senha/);
  assert.equal(login.includes(legacyUniversalPassword), false);
  assert.equal(reset.includes(legacyUniversalPassword), false);
});

test('fluxo interno de homologação exige segredo de ambiente e não o devolve', () => {
  const content = read('src', 'app', 'api', 'internal', 'homologation-setup', 'route.ts');
  assert.match(content, /MPM_HOMOLOGATION_INITIAL_PASSWORD/);
  assert.equal(content.includes(legacyUniversalPassword), false);
  assert.doesNotMatch(content, /password:\s*homologationPassword,\s*\n\s*loginsValidated/);
});

test('banner legado orienta troca sem revelar credencial', () => {
  const layout = read('src', 'app', '(dashboard)', 'layout.tsx');
  assert.match(layout, /marcada para troca de senha/);
  assert.equal(layout.includes(legacyUniversalPassword), false);
});
