import { createHash } from 'crypto';

export const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
export const TIKTOK_REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/';
export const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
export const TIKTOK_VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';

export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export function getTikTokConfig(): TikTokConfig | null {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim()
    || 'https://midiapormidia.com.br/api/social/tiktok/callback';

  if (!clientKey || !clientSecret) return null;
  const parsed = new URL(redirectUri);
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProd && parsed.protocol !== 'https:') {
    throw new Error('TIKTOK_REDIRECT_URI deve usar HTTPS em produção.');
  }

  return { clientKey, clientSecret, redirectUri, scopes: ['user.info.basic'] };
}

export function getSafeTikTokDiagnostics(config: TikTokConfig) {
  const redirect = new URL(config.redirectUri);
  return {
    clientKeyLast4: config.clientKey.slice(-4),
    clientKeySha256: createHash('sha256').update(config.clientKey).digest('hex'),
    redirectHostname: redirect.hostname,
    redirectPathname: redirect.pathname,
  };
}

export function scopesFromTikTok(value: string | undefined): string[] {
  return (value || '').split(',').map((scope) => scope.trim()).filter(Boolean);
}

export function getTikTokRequestedScopes(input: {
  displayEnabled: boolean;
  uploadEnabled: boolean;
  directPostEnabled: boolean;
}): string[] {
  const scopes = ['user.info.basic'];
  if (input.displayEnabled) scopes.push('video.list');
  if (input.uploadEnabled) scopes.push('video.upload');
  if (input.directPostEnabled) scopes.push('video.publish');
  return scopes;
}

export function detectTikTokCapabilities(input: {
  scopes: string[];
  profileVerified: boolean;
  videoListVerified: boolean;
  displayEnabled: boolean;
  uploadEnabled: boolean;
  directPostEnabled: boolean;
}) {
  const granted = new Set(input.scopes);
  return {
    profileReadCapable: input.profileVerified && granted.has('user.info.basic'),
    videoListCapable: input.displayEnabled && input.videoListVerified && granted.has('video.list'),
    videoUploadCapable: input.uploadEnabled && granted.has('video.upload'),
    directPostCapable: input.directPostEnabled && granted.has('video.publish'),
    metricsCapable: false,
  };
}
