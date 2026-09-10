import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { generateOAuthState, verifyOAuthState, detectChannelCapabilities } from '../src/lib/social/meta.ts';
import { calculateCreatorDynamicPrice } from '../src/lib/mpm/creator-pricing.ts';

const sqlStage2 = readFileSync(new URL('../supabase/migrations/20260908000300_mpm_social_marketplace_stage2.sql', import.meta.url), 'utf8');
const sqlStage2Test = readFileSync(new URL('../supabase/tests/mpm_social_marketplace_stage2.sql', import.meta.url), 'utf8');

test('OAuth state é válido, protegido por HMAC e verifica expiração', () => {
  const secret = 'super_secret_test_key_1234567890';
  const state = generateOAuthState({
    userId: 'usr-123',
    ownerType: 'creator',
    ownerId: 'cr-456',
    provider: 'instagram',
    returnTo: '/creator?tab=social',
  }, secret);

  assert.ok(state.includes('.'), 'State deve conter separador de assinatura');
  const verified = verifyOAuthState(state, secret);
  assert.equal(verified.userId, 'usr-123');
  assert.equal(verified.ownerType, 'creator');
  assert.equal(verified.ownerId, 'cr-456');

  // Rejeita assinatura falsificada
  assert.throws(() => verifyOAuthState(state + 'tampered', secret));
  assert.throws(() => verifyOAuthState(state, 'wrong_secret'));

  // Rejeita state expirado
  const expiredPayload = Buffer.from(JSON.stringify({
    userId: 'usr-123', ownerType: 'creator', ownerId: 'cr-456', nonce: 'abc', exp: Date.now() - 1000,
  })).toString('base64url');
  const expiredSig = createHmac('sha256', secret).update(expiredPayload).digest('base64url');
  assert.throws(() => verifyOAuthState(`${expiredPayload}.${expiredSig}`, secret), /expirado/);
});

test('Detecção de capacidade social valida feed, reel e story sem premissas cegas', () => {
  // Facebook Page sem permissão de postagem
  const pageNoPublish = detectChannelCapabilities('facebook_page', ['pages_show_list', 'pages_read_engagement']);
  assert.equal(pageNoPublish.feedPublishCapable, false);
  assert.equal(pageNoPublish.diagnosticStatus, 'partial_permission');

  // Facebook Page com permissão completa
  const pageReady = detectChannelCapabilities('facebook_page', ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']);
  assert.equal(pageReady.feedPublishCapable, true);
  assert.equal(pageReady.reelPublishCapable, false);
  assert.equal(pageReady.diagnosticStatus, 'ready_for_campaigns');

  // Instagram com Feed e Reels, mas Story inelegível
  const instaFeed = detectChannelCapabilities('instagram_professional', ['instagram_basic', 'instagram_content_publish'], {
    is_business_account: true,
    story_eligible: false,
  });
  assert.equal(instaFeed.feedPublishCapable, true);
  assert.equal(instaFeed.reelPublishCapable, true);
  assert.equal(instaFeed.storyPublishCapable, false);
  assert.equal(instaFeed.diagnosticStatus, 'ready_for_campaigns');

  // Instagram com Story explicitamente liberado pela API
  const instaFull = detectChannelCapabilities('instagram_professional', ['instagram_basic', 'instagram_content_publish'], {
    is_business_account: true,
    story_eligible: true,
  });
  assert.equal(instaFull.storyPublishCapable, true);
});

test('Dynamic Pricing Engine produz preços estáveis, ponderados e limitados', () => {
  const lowCreator = calculateCreatorDynamicPrice('feed', {
    followers: 1000,
    engagementRate: 1.5,
    localRelevance: 30,
    creatorScore: 40,
    mediaValueScore: 40,
  });
  assert.ok(lowCreator.suggestedPriceCredits >= 20.0, 'Preço respeita piso mínimo configurado');

  const highLocalCreator = calculateCreatorDynamicPrice('feed', {
    followers: 30000,
    engagementRate: 4.5,
    localRelevance: 95,
    creatorScore: 90,
    mediaValueScore: 92,
  });
  assert.ok(highLocalCreator.suggestedPriceCredits > lowCreator.suggestedPriceCredits);

  // Formatos diferentes têm preços base proporcionais
  const storyPrice = calculateCreatorDynamicPrice('story', {
    followers: 10000, engagementRate: 3.0, localRelevance: 50, creatorScore: 70, mediaValueScore: 70,
  });
  const reelPrice = calculateCreatorDynamicPrice('reel', {
    followers: 10000, engagementRate: 3.0, localRelevance: 50, creatorScore: 70, mediaValueScore: 70,
  });
  assert.ok(reelPrice.suggestedPriceCredits > storyPrice.suggestedPriceCredits);
});

test('Contratos de Banco da Etapa 2: RLS, congelamento de cotação e isolamento', () => {
  // Verifica tabelas e colunas adicionadas
  assert.match(sqlStage2, /publication_mode/);
  assert.match(sqlStage2, /feed_publish_capable/);
  assert.match(sqlStage2, /is_public_profile/);
  assert.match(sqlStage2, /is_public_screen/);
  assert.match(sqlStage2, /creator_pricing_rules/);

  // Telas residenciais protegidas
  assert.match(sqlStage2, /venue_type = 'residential'/);
  assert.match(sqlStage2, /is_public_screen = false/);

  // Cotação congela preço
  assert.match(sqlStage2, /quote_creator_media/);
  assert.match(sqlStage2, /frozen_at/);

  // Prova social integrada ao settlement sem gerar crédito MPM espúrio
  assert.match(sqlStage2, /submit_social_proof_of_publication/);
  assert.match(sqlStage2, /record_validated_delivery_proof/);

  // Vitrine pública protege dados privados
  assert.match(sqlStage2, /get_public_showcase_data/);
  assert.match(sqlStage2, /venue_type <> 'residential'/);
  assert.match(sqlStage2, /show_in_marketplace = true/);
});

test('Teste de regressão SQL da Etapa 2 cobre quote congelado e privacidade residencial', () => {
  assert.match(sqlStage2Test, /calculate_creator_dynamic_price/);
  assert.match(sqlStage2Test, /set_creator_rate_card/);
  assert.match(sqlStage2Test, /quote_creator_media/);
  assert.match(sqlStage2Test, /submit_social_proof_of_publication/);
  assert.match(sqlStage2Test, /residential/);
  assert.match(sqlStage2Test, /ROLLBACK/);
});
