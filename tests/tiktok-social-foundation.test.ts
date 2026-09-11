import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { generateOAuthState, verifyOAuthState } from '../src/lib/social/meta.ts';
import {
  detectTikTokCapabilities,
  getTikTokRequestedScopes,
  scopesFromTikTok,
  TIKTOK_AUTHORIZE_URL,
  TIKTOK_TOKEN_URL,
  TIKTOK_USER_INFO_URL,
} from '../src/lib/social/tiktok.ts';

const root = process.cwd();
const migration = readFileSync(join(root, 'supabase/migrations/20260910000370_tiktok_social_foundation.sql'), 'utf8');
const startRoute = readFileSync(join(root, 'src/app/api/social/tiktok/start/route.ts'), 'utf8');
const callbackRoute = readFileSync(join(root, 'src/app/api/social/tiktok/callback/route.ts'), 'utf8');
const actions = readFileSync(join(root, 'src/app/actions/social.ts'), 'utf8');
const tiktokLib = readFileSync(join(root, 'src/lib/social/tiktok.ts'), 'utf8');

test('TikTok usa endpoints OAuth e Display API oficiais atuais', () => {
  assert.equal(TIKTOK_AUTHORIZE_URL, 'https://www.tiktok.com/v2/auth/authorize/');
  assert.equal(TIKTOK_TOKEN_URL, 'https://open.tiktokapis.com/v2/oauth/token/');
  assert.equal(TIKTOK_USER_INFO_URL, 'https://open.tiktokapis.com/v2/user/info/');
  assert.match(startRoute, /response_type.*code/);
  assert.match(tiktokLib, /user\.info\.basic/);
  assert.match(callbackRoute, /grant_type: 'authorization_code'/);
});

test('State TikTok é assinado e carrega owner canônico sem token', () => {
  const state = generateOAuthState({
    userId: 'user-1', ownerType: 'creator', ownerId: 'creator-1', provider: 'tiktok', returnTo: '/creator?tab=social',
  }, 'test_secret_for_tiktok_state_32_chars');
  const parsed = verifyOAuthState(state, 'test_secret_for_tiktok_state_32_chars');
  assert.equal(parsed.provider, 'tiktok');
  assert.equal(parsed.ownerId, 'creator-1');
  assert.doesNotMatch(state, /access_token|refresh_token/);
});

test('Migration 370 é única, incremental e reaproveita tabelas sociais', () => {
  assert.match(migration, /provider IN \('facebook','instagram','tiktok'\)/);
  assert.match(migration, /tiktok_login/);
  assert.match(migration, /encrypted_refresh_token/);
  assert.match(migration, /refresh_expires_at/);
  assert.match(migration, /profile_read_capable/);
  assert.match(migration, /video_list_capable/);
  assert.match(migration, /video_upload_capable/);
  assert.match(migration, /direct_post_capable/);
  assert.doesNotMatch(migration, /CREATE TABLE.*tiktok_/i);
});

test('Capabilities TikTok dependem simultaneamente de scope, API e flags', () => {
  const scopes = scopesFromTikTok('user.info.basic,video.list,video.upload,video.publish');
  const blocked = detectTikTokCapabilities({
    scopes, profileVerified: true, videoListVerified: true,
    displayEnabled: false, uploadEnabled: false, directPostEnabled: false,
  });
  assert.equal(blocked.profileReadCapable, true);
  assert.equal(blocked.videoListCapable, false);
  assert.equal(blocked.videoUploadCapable, false);
  assert.equal(blocked.directPostCapable, false);

  const approved = detectTikTokCapabilities({
    scopes, profileVerified: true, videoListVerified: true,
    displayEnabled: true, uploadEnabled: true, directPostEnabled: true,
  });
  assert.equal(approved.videoListCapable, true);
  assert.equal(approved.videoUploadCapable, true);
  assert.equal(approved.directPostCapable, true);

  assert.deepEqual(getTikTokRequestedScopes({
    displayEnabled: false, uploadEnabled: false, directPostEnabled: false,
  }), ['user.info.basic']);
  assert.deepEqual(getTikTokRequestedScopes({
    displayEnabled: true, uploadEnabled: true, directPostEnabled: true,
  }), ['user.info.basic', 'video.list', 'video.upload', 'video.publish']);
});

test('Tokens TikTok são criptografados, renováveis, revogáveis e nunca registrados', () => {
  assert.match(callbackRoute, /encryptSocialToken\(token\.access_token\)/);
  assert.match(callbackRoute, /encryptSocialToken\(token\.refresh_token\)/);
  assert.match(actions, /grant_type: 'refresh_token'/);
  assert.match(actions, /TIKTOK_REVOKE_URL/);
  assert.match(actions, /encrypted_refresh_token: null/);
  assert.doesNotMatch(callbackRoute, /console\.(?:log|info|error)\([^\n]*(?:token\.access_token|token\.refresh_token)/);
});

test('Callback valida sessão, owner, perfil real e persiste owner correto', () => {
  assert.match(callbackRoute, /user\.id !== state\.userId/);
  assert.match(callbackRoute, /creator_profiles/);
  assert.match(callbackRoute, /company_users/);
  assert.match(callbackRoute, /tiktokUser\?\.open_id === token\.open_id/);
  assert.match(callbackRoute, /owner_type: state\.ownerType/);
  assert.match(callbackRoute, /owner_id: state\.ownerId/);
  assert.match(callbackRoute, /onConflict: 'provider,provider_account_id'/);
  assert.match(callbackRoute, /onConflict: 'provider,provider_channel_id'/);
  assert.match(callbackRoute, /account_already_connected/);
  assert.match(startRoute, /!requestedReturnTo\.startsWith\('\/\/'\)/);
});
