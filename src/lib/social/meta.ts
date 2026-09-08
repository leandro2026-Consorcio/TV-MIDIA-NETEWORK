import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export interface MetaConfig {
  appId: string;
  appSecret: string;
  graphVersion: string;
  redirectUri: string;
}

export function getMetaConfig(): MetaConfig | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const graphVersion = process.env.META_GRAPH_VERSION || 'v19.0';
  const redirectUri = process.env.META_REDIRECT_URI || 'https://midiapormidia.com.br/api/social/meta/callback';

  if (!appId || !appSecret) {
    return null;
  }
  return { appId, appSecret, graphVersion, redirectUri };
}

export interface OAuthStatePayload {
  nonce: string;
  userId: string;
  ownerType: 'company' | 'organic_participant' | 'creator';
  ownerId: string;
  exp: number;
}

export function generateOAuthState(payload: Omit<OAuthStatePayload, 'nonce' | 'exp'>, appSecret: string): string {
  const nonce = randomBytes(18).toString('base64url');
  const fullPayload: OAuthStatePayload = {
    ...payload,
    nonce,
    exp: Date.now() + 10 * 60_000, // 10 minutos de validade
  };
  const json = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = createHmac('sha256', appSecret).update(json).digest('base64url');
  return `${json}.${signature}`;
}

export function verifyOAuthState(stateString: string, appSecret: string): OAuthStatePayload {
  const [payloadRaw, signature] = stateString.split('.');
  if (!payloadRaw || !signature) {
    throw new Error('State OAuth mal formatado.');
  }

  const expected = createHmac('sha256', appSecret).update(payloadRaw).digest('base64url');
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Assinatura de state OAuth inválida.');
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
  accountMetadata: Record<string, any> = {}
): DetectedCapabilities {
  const hasPagePublish = grantedScopes.includes('pages_manage_posts');
  const hasInstaPublish = grantedScopes.includes('instagram_content_publish');
  const hasEngagement = grantedScopes.includes('pages_read_engagement') || grantedScopes.includes('instagram_basic');

  if (channelType === 'facebook_page') {
    const feed = hasPagePublish;
    const insights = hasEngagement;
    const ready = feed && insights;

    return {
      feedPublishCapable: feed,
      reelPublishCapable: false,
      storyPublishCapable: false,
      insightsCapable: insights,
      metricsCapable: insights,
      diagnosticStatus: ready ? 'ready_for_campaigns' : (hasEngagement ? 'partial_permission' : 'connected'),
      diagnosticMessage: ready
        ? 'Página pronta para publicação no feed e coleta de métricas.'
        : 'Permissão parcial: necessária autorização de publicação para veicular anúncios.',
    };
  } else {
    // instagram_professional
    const feed = hasInstaPublish;
    const reel = hasInstaPublish && (accountMetadata.is_business_account !== false);
    // Story requer suporte explícito da API Meta e conta Business elegível
    const story = hasInstaPublish && Boolean(accountMetadata.story_eligible);
    const insights = hasEngagement;
    const ready = feed && insights;

    return {
      feedPublishCapable: feed,
      reelPublishCapable: reel,
      storyPublishCapable: story,
      insightsCapable: insights,
      metricsCapable: insights,
      diagnosticStatus: ready ? 'ready_for_campaigns' : (hasEngagement ? 'partial_permission' : 'connected'),
      diagnosticMessage: ready
        ? `Instagram profissional pronto (${reel ? 'Feed e Reels' : 'Feed'}).${story ? ' Stories habilitado.' : ' Stories aguarda liberação de permissão Meta.'}`
        : 'Permissão de publicação do Instagram pendente de concessão no login da Meta.',
    };
  }
}
