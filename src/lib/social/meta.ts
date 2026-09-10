import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

export type SocialProvider = 'instagram' | 'facebook';
export type SocialAuthFlow = 'instagram_login' | 'facebook_login';

export interface ProviderConfig {
  provider: SocialProvider;
  authFlow: SocialAuthFlow;
  appId: string;
  appSecret: string;
  graphVersion: string;
  redirectUri: string;
  dialogUrl: string;
  tokenUrl: string;
  scopes: string[];
  configId?: string;
}

const DEFAULT_INSTAGRAM_REDIRECT_URI =
  'https://midiapormidia.com.br/api/social/instagram/callback';

/**
 * Retorna a string canônica usada tanto no diálogo quanto na troca do code.
 * Não reconstrói nem normaliza a URL, porque a Meta exige igualdade byte a byte.
 */
export function getInstagramRedirectUri(): string {
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || DEFAULT_INSTAGRAM_REDIRECT_URI;

  if (redirectUri !== redirectUri.trim()) {
    throw new Error('INSTAGRAM_REDIRECT_URI não pode conter espaços nas extremidades.');
  }

  const parsed = new URL(redirectUri);
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProd && parsed.protocol !== 'https:') {
    throw new Error('INSTAGRAM_REDIRECT_URI deve usar HTTPS em produção.');
  }

  return redirectUri;
}

export function getSafeRedirectDiagnostics(redirectUri: string) {
  const parsed = new URL(redirectUri);
  return {
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    hasQueryString: parsed.search.length > 0,
    length: redirectUri.length,
    sha256: createHash('sha256').update(redirectUri, 'utf8').digest('hex'),
  };
}

export function logSafeOAuthDiagnostics(
  stage: 'authorization' | 'exchange',
  config: Pick<ProviderConfig, 'provider' | 'appId' | 'redirectUri'>
) {
  if (process.env.META_OAUTH_DIAGNOSTICS !== '1') return;

  console.info('[Meta OAuth Diagnostics]', {
    provider: config.provider,
    stage,
    redirect: getSafeRedirectDiagnostics(config.redirectUri),
    clientIdLast4: config.appId.slice(-4),
    clientIdSha256: createHash('sha256').update(config.appId, 'utf8').digest('hex'),
  });
}

export function getStateSecret(): string {
  const secret = process.env.SOCIAL_OAUTH_STATE_SECRET;
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (!secret) {
    if (isProd) {
      throw new Error('SOCIAL_OAUTH_STATE_SECRET é obrigatório em ambiente de produção (fail-closed).');
    }
    // Em desenvolvimento estrito, exige chave ou usa secret local avisando no log
    const fallback = process.env.META_APP_SECRET || 'dev_social_oauth_state_secret_min_32_chars_ok';
    return fallback;
  }
  return secret;
}

export function getGraphVersion(): string {
  const version = process.env.META_GRAPH_VERSION;
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (!version) {
    if (isProd) {
      throw new Error('META_GRAPH_VERSION é obrigatório em ambiente de produção. Não é permitido fallback silencioso.');
    }
    return 'v21.0';
  }
  return version;
}

export function getProviderConfig(provider: SocialProvider): ProviderConfig | null {
  const graphVersion = getGraphVersion();

  if (provider === 'instagram') {
    const appId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET;
    const redirectUri = getInstagramRedirectUri();

    if (!appId || !appSecret || !redirectUri) return null;

    return {
      provider: 'instagram',
      authFlow: 'instagram_login',
      appId,
      appSecret,
      graphVersion,
      redirectUri,
      dialogUrl: 'https://www.instagram.com/oauth/authorize',
      tokenUrl: 'https://api.instagram.com/oauth/access_token',
      scopes: [
        'instagram_business_basic',
        'instagram_business_content_publish',
        'instagram_business_manage_insights',
      ],
    };
  }

  // provider === 'facebook'
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI || process.env.META_REDIRECT_URI || 'https://midiapormidia.com.br/api/social/meta/callback?provider=facebook';

  if (!appId || !appSecret || !redirectUri) return null;

  return {
    provider: 'facebook',
    authFlow: 'facebook_login',
    appId,
    appSecret,
    graphVersion,
    redirectUri,
    dialogUrl: `https://www.facebook.com/${graphVersion}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${graphVersion}/oauth/access_token`,
    configId: process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim() || undefined,
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
    ],
  };
}

export interface OAuthStatePayload {
  nonce: string;
  userId: string;
  ownerType: 'company' | 'organic_participant' | 'creator';
  ownerId: string;
  provider: SocialProvider;
  returnTo: string;
  exp: number;
}

export function generateOAuthState(
  payload: Omit<OAuthStatePayload, 'nonce' | 'exp'>,
  secretOverride?: string
): string {
  const secret = secretOverride || getStateSecret();
  const nonce = randomBytes(18).toString('base64url');
  const fullPayload: OAuthStatePayload = {
    ...payload,
    nonce,
    exp: Date.now() + 10 * 60_000, // 10 minutos de validade
  };
  const json = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(json).digest('base64url');
  return `${json}.${signature}`;
}

export function verifyOAuthState(stateString: string, secretOverride?: string): OAuthStatePayload {
  const secret = secretOverride || getStateSecret();
  const [payloadRaw, signature] = stateString.split('.');
  if (!payloadRaw || !signature) {
    throw new Error('State OAuth mal formatado.');
  }

  const expected = createHmac('sha256', secret).update(payloadRaw).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Assinatura de state OAuth inválida ou violada.');
  }

  const payload = JSON.parse(Buffer.from(payloadRaw, 'base64url').toString('utf8')) as OAuthStatePayload;
  if (payload.exp < Date.now()) {
    throw new Error('State OAuth expirado. Inicie a conexão novamente.');
  }

  return payload;
}

export interface DetectedCapabilities {
  feedPublishCapable: boolean;
  reelPublishCapable: boolean;
  storyPublishCapable: boolean;
  insightsCapable: boolean;
  metricsCapable: boolean;
  diagnosticStatus: 'connected' | 'partial_permission' | 'expired_token' | 'ineligible_account' | 'external_error' | 'ready_for_campaigns';
  diagnosticMessage: string;
}

export function detectChannelCapabilities(
  channelType: 'facebook_page' | 'instagram_professional',
  grantedScopes: string[],
  accountMetadata: Record<string, any> = {},
  metricsGlobalFlag: boolean = false
): DetectedCapabilities {
  if (channelType === 'facebook_page') {
    const feed = grantedScopes.includes('pages_manage_posts');
    const hasRead = grantedScopes.includes('pages_read_engagement');
    const insights = hasRead && metricsGlobalFlag;
    const ready = feed;

    return {
      feedPublishCapable: feed,
      reelPublishCapable: false,
      storyPublishCapable: false,
      insightsCapable: insights,
      metricsCapable: insights,
      diagnosticStatus: ready ? 'ready_for_campaigns' : (hasRead ? 'partial_permission' : 'connected'),
      diagnosticMessage: ready
        ? 'Página do Facebook pronta para veiculação no feed.'
        : 'Permissão de publicação pendente na Página.',
    };
  } else {
    // instagram_professional
    const hasPublish =
      grantedScopes.includes('instagram_business_content_publish') ||
      grantedScopes.includes('instagram_content_publish');
    const hasInsightsScope =
      grantedScopes.includes('instagram_business_manage_insights') ||
      grantedScopes.includes('instagram_manage_insights');
    const feed = hasPublish;
    const reel = hasPublish;
    const story =
      hasPublish && (Boolean(accountMetadata.story_capable) || Boolean(accountMetadata.story_eligible));
    const insights = hasInsightsScope && metricsGlobalFlag;
    const ready = feed;

    return {
      feedPublishCapable: feed,
      reelPublishCapable: reel,
      storyPublishCapable: story,
      insightsCapable: insights,
      metricsCapable: insights,
      diagnosticStatus: ready ? 'ready_for_campaigns' : 'connected',
      diagnosticMessage: ready
        ? `Instagram profissional pronto (Feed e Reels).${story ? ' Stories habilitado.' : ' Stories aguarda elegibilidade de conta.'}`
        : 'Permissão de publicação pendente no Instagram.',
    };
  }
}
