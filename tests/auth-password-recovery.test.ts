import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_INITIAL_PASSWORD, validatePassword, validateResetEmail } from '../src/lib/auth-constants.ts';

const rootDir = process.cwd();

test('1. Senha inicial padrão é exatamente midiapormidia@123', () => {
  assert.equal(DEFAULT_INITIAL_PASSWORD, 'midiapormidia@123');
});

test('2. Validação de e-mail de recuperação rejeita e-mail inválido', () => {
  const resEmpty = validateResetEmail('');
  assert.equal(resEmpty.valid, false);
  assert.match(resEmpty.error || '', /e-mail válido/i);

  const resInvalid = validateResetEmail('email-sem-formato');
  assert.equal(resInvalid.valid, false);
  assert.match(resInvalid.error || '', /e-mail válido/i);

  const resValid = validateResetEmail('usuario@empresa.com.br');
  assert.equal(resValid.valid, true);
});

test('3. Validação de senha exige no mínimo 6 caracteres', () => {
  const resShort = validatePassword('123');
  assert.equal(resShort.valid, false);
  assert.match(resShort.error || '', /no mínimo 6 caracteres/i);

  const resValid = validatePassword('midiapormidia@123');
  assert.equal(resValid.valid, true);
});

test('4. Middleware declara rotas públicas de recuperação e redefinição de senha', () => {
  const middlewarePath = join(rootDir, 'src', 'lib', 'supabase', 'middleware.ts');
  const content = readFileSync(middlewarePath, 'utf8');

  assert.ok(content.includes("pathname.startsWith('/forgot-password')"), 'Falta /forgot-password no middleware');
  assert.ok(content.includes("pathname.startsWith('/recuperar-senha')"), 'Falta /recuperar-senha no middleware');
  assert.ok(content.includes("pathname.startsWith('/reset-password')"), 'Falta /reset-password no middleware');
  assert.ok(content.includes("pathname.startsWith('/redefinir-senha')"), 'Falta /redefinir-senha no middleware');
  assert.ok(content.includes("pathname.startsWith('/auth/')"), 'Falta /auth/ no middleware');
});

test('5. Formulário de cadastro da empresa preenche senha inicial padrão midiapormidia@123', () => {
  const formPath = join(rootDir, 'src', 'components', 'company-signup-form.tsx');
  const content = readFileSync(formPath, 'utf8');

  assert.ok(content.includes('defaultValue="midiapormidia@123"'), 'Formulário da empresa não possui defaultValue midiapormidia@123');
  assert.ok(content.includes('midiapormidia@123'), 'Falta menção explicativa à senha padrão no form');
});

test('6. Formulário de cadastro de tela orgânica define senha inicial padrão midiapormidia@123', () => {
  const organicPath = join(rootDir, 'src', 'app', 'organic', 'register', 'page.tsx');
  const content = readFileSync(organicPath, 'utf8');

  assert.ok(content.includes("password: 'midiapormidia@123'"), 'Formulário orgânico não inicia com midiapormidia@123');
  assert.ok(content.includes('midiapormidia@123'), 'Falta menção explicativa à senha padrão no registro orgânico');
});

test('7. Tela de login inclui opção Esqueci minha senha e dica de primeiro acesso', () => {
  const loginPath = join(rootDir, 'src', 'app', '(auth)', 'login', 'page.tsx');
  const content = readFileSync(loginPath, 'utf8');

  assert.ok(content.includes('Esqueci minha senha'), 'Falta botão Esqueci minha senha na tela de login');
  assert.ok(content.includes('midiapormidia@123'), 'Falta dica de senha padrão midiapormidia@123 no login');
  assert.ok(content.includes('Recuperar Senha'), 'Falta modo de recuperação de senha no login');
});

test('8. Dashboard layout permite rota /reset-password e exibe banner de segurança se aplicável', () => {
  const layoutPath = join(rootDir, 'src', 'app', '(dashboard)', 'layout.tsx');
  const content = readFileSync(layoutPath, 'utf8');

  assert.ok(content.includes("'/reset-password'"), 'Layout não inclui /reset-password nas rotas permitidas');
  assert.ok(content.includes('midiapormidia@123'), 'Layout não inclui menção ao banner de troca de senha');
});
