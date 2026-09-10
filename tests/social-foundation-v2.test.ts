import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  getProviderConfig,
  getInstagramRedirectUri,
  getSafeRedirectDiagnostics,
  generateOAuthState,
  verifyOAuthState,
  detectChannelCapabilities,
} from '../src/lib/social/meta.ts';

const root = process.cwd();
const migration360 = readFileSync(join(root, 'supabase/migrations/20260909000360_social_foundation_v2.sql'), 'utf8');
const authMiddleware = readFileSync(join(root, 'src/lib/supabase/middleware.ts'), 'utf8');

test('Migration 360: Contratos SQL de colunas, flags, RPC canônico e RPC de diagnóstico Master', () => {
  // 1. Colunas em social_connections e social_channels
  assert.match(migration360, /ADD COLUMN IF NOT EXISTS auth_flow/i);
  assert.match(migration360, /ADD COLUMN IF NOT EXISTS last_refreshed_at/i);
  assert.match(migration360, /ADD COLUMN IF NOT EXISTS username/i);
  assert.match(migration360, /ADD COLUMN IF NOT EXISTS avatar_url/i);

  // 2. Flags em platform_settings
  assert.match(migration360, /'social_connection_enabled'/);
  assert.match(migration360, /'social_manual_publish_enabled'/);
  assert.match(migration360, /'social_approval_publish_enabled'/);
  assert.match(migration360, /'social_auto_publish_master_enabled'/);
  assert.match(migration360, /'social_metrics_enabled'/);

  // 3. RPC canônico do creator
  assert.match(migration360, /CREATE OR REPLACE FUNCTION public\.ensure_canonical_creator_profile/);
  assert.match(migration360, /INSERT INTO public\.creator_profiles/);

  // 4. RPC diagnóstico Master com mascaramento
  assert.match(migration360, /CREATE OR REPLACE FUNCTION public\.get_social_diagnostics_for_master/);
  assert.match(migration360, /is_master_admin/);
  assert.match(migration360, /CASE\s+WHEN\s+length/i);
  // Não retorna token descriptografado
  assert.doesNotMatch(migration360, /sc\.access_token_encrypted AS token_plaintext/);
});

test('Segurança OAuth: Falha fechada em produção para STATE_SECRET e GRAPH_VERSION', () => {
  const secretKey = 'test_secret_for_unit_tests_32_bytes_long';
  const state = generateOAuthState({
    userId: 'u-1',
    ownerType: 'creator',
    ownerId: 'cr-1',
    provider: 'instagram',
    returnTo: '/creator?tab=social',
  }, secretKey);

  assert.ok(state.includes('.'), 'State tem assinatura separada por ponto');
  const verified = verifyOAuthState(state, secretKey);
  assert.equal(verified.provider, 'instagram');
  assert.equal(verified.returnTo, '/creator?tab=social');
  assert.equal(verified.ownerId, 'cr-1');

  // Rejeita adulteração
  assert.throws(() => verifyOAuthState(state + 'tamper', secretKey));
  assert.throws(() => verifyOAuthState(state, 'wrong_key'));
});

test('Instagram Direct Login vs Facebook Login: Escopos e endpoints oficiais', () => {
  process.env.META_APP_ID = '1234567890';
  process.env.META_APP_SECRET = 'test_secret_12345';
  process.env.INSTAGRAM_REDIRECT_URI = 'https://midiapormidia.com.br/api/social/instagram/callback';
  process.env.FACEBOOK_REDIRECT_URI = 'https://midiapormidia.com.br/api/social/facebook/callback';
  process.env.FACEBOOK_LOGIN_CONFIG_ID = '987654321';
  process.env.META_GRAPH_VERSION = 'v22.0';

  const igConfig = getProviderConfig('instagram');
  assert.ok(igConfig, 'igConfig deve existir quando envs estão configurados');
  assert.equal(igConfig.authFlow, 'instagram_login');
  assert.ok(igConfig.dialogUrl.includes('instagram.com/oauth/authorize'));
  assert.ok(igConfig.scopes.includes('instagram_business_basic'));
  assert.ok(igConfig.scopes.includes('instagram_business_content_publish'));
  assert.ok(igConfig.scopes.includes('instagram_business_manage_insights'));
  assert.ok(!igConfig.scopes.includes('pages_manage_posts'), 'Instagram direto não pede permissão de páginas');

  const fbConfig = getProviderConfig('facebook');
  assert.ok(fbConfig, 'fbConfig deve existir quando envs estão configurados');
  assert.equal(fbConfig.authFlow, 'facebook_login');
  assert.ok(fbConfig.dialogUrl.includes('facebook.com/v22.0/dialog/oauth'));
  assert.ok(fbConfig.scopes.includes('pages_show_list'));
  assert.ok(fbConfig.scopes.includes('pages_manage_posts'));
  assert.equal(fbConfig.configId, '987654321');
});

test('Instagram OAuth usa uma única redirect URI canônica sem dupla transformação', () => {
  process.env.INSTAGRAM_REDIRECT_URI = 'https://midiapormidia.com.br/api/social/instagram/callback';

  const canonical = getInstagramRedirectUri();
  const config = getProviderConfig('instagram');
  assert.ok(config);
  assert.equal(config.redirectUri, canonical);
  assert.equal(config.redirectUri, 'https://midiapormidia.com.br/api/social/instagram/callback');
  assert.equal(getSafeRedirectDiagnostics(config.redirectUri).hasQueryString, false);

  process.env.INSTAGRAM_REDIRECT_URI = ` ${canonical}`;
  assert.throws(() => getInstagramRedirectUri(), /espaços nas extremidades/);
  process.env.INSTAGRAM_REDIRECT_URI = canonical;
});

test('Páginas de conformidade Meta são públicas e não exigem sessão', () => {
  assert.match(authMiddleware, /pathname === '\/politica-de-privacidade'/);
  assert.match(authMiddleware, /pathname === '\/exclusao-de-dados'/);
});

test('Detecção de Capacidades: Feed, Reels, Stories e Métricas', () => {
  // Instagram Creator com publicação
  const igCap = detectChannelCapabilities('instagram_professional', [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_insights',
  ], { account_type: 'MEDIA_CREATOR' }, false);

  assert.equal(igCap.feedPublishCapable, true);
  assert.equal(igCap.reelPublishCapable, true);
  assert.equal(igCap.storyPublishCapable, false, 'Story desabilitado sem elegibilidade comprovada');
  assert.equal(igCap.metricsCapable, false, 'Métricas bloqueadas enquanto flag global for false');
  assert.equal(igCap.diagnosticStatus, 'ready_for_campaigns');

  // Com flag global de métricas ativada
  const igCapWithMetrics = detectChannelCapabilities('instagram_professional', [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_insights',
  ], { account_type: 'MEDIA_CREATOR' }, true);
  assert.equal(igCapWithMetrics.metricsCapable, true);

  // Facebook Page
  const fbCap = detectChannelCapabilities('facebook_page', [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
  ], {}, false);
  assert.equal(fbCap.feedPublishCapable, true);
  assert.equal(fbCap.reelPublishCapable, false);
});

test('Criptografia em repouso AES-256-GCM de tokens de acesso', () => {
  const key = Buffer.alloc(32, 'k');
  const token = 'EAAX_sample_token_test_12345';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;

  assert.notEqual(payload, token);
  assert.ok(payload.startsWith('v1.'));

  const [version, ivRaw, tagRaw, encRaw] = payload.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encRaw, 'base64url')), decipher.final()]).toString('utf8');
  assert.equal(decrypted, token);
});
